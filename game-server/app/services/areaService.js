var dataApi = require('../util/dataApi');
var utils = require('../util/utils');
var pomelo = require('pomelo');
var userDao = require('../dao/userDao');
var taskDao = require('../dao/taskDao');
var Map = require('../domain/map/map');
var AreaType = require('../consts/consts').AreaType;
var async = require('async');

var logger = require('pomelo-logger').getLogger(__filename);

var maps = {};  //游戏地图组

var exp = module.exports;

//场景服务初始化。设置场景权重，为每个场景游戏地图map，Key为场景id（app启动立即调用该函数。这时是还没有场景的，只是提供了服务）
exp.init = function(){
  var areas = dataApi.area.all(); //获取场景数据数组

  //遍历场景数据组，设置权重，添加游戏地图
  for(var key in areas){
    //init map
    var area = areas[key];

    area.weightMap = false;
    maps[area.id] = new Map(area);
  }
};

/**
 * Proxy for map, get born place for given map
 * @api public
 */
//生成出生地。通过场景id，对应的游戏地图，获取出生地数据
exp.getBornPlace = function(sceneId){
  return maps[sceneId].getBornPlace();
};

/**
 * Proxy for map, get born point for given map
 * @api public
 */
//获取出生点。通过场景id，对应的游戏地图，从出生地中生成出生点
exp.getBornPoint = function(sceneId){
  return maps[sceneId].getBornPoint();
};

/**
 * Change area, will transfer a player from one area to another
 * @param args {Object} The args for transfer area, the content is {playerId, areaId, target, frontendId}
 * @param cb {funciton} Call back funciton
 * @api public
 */
//切换场景。（playerHandler.changeArea调用该函数，客户端发起切换场景使用）
exp.changeArea = function(args, session, cb) {
  var app = pomelo.app;
  var area = session.area;
  var uid = args.uid;
  var playerId = args.playerId;
  var target = args.target;
  var player = area.getPlayer(playerId);
  var frontendId = args.frontendId;   

  //通过目标areaId，获取要切换的目标场景数据
  var targetInfo = dataApi.area.findById(target);

  //如果目标场景为普通场景。当前场景删除玩家，获取目标场景出生点，玩家属性直线目标场景---------------------------------普通场景
  if(targetInfo.type === AreaType.SCENE){
    area.removePlayer(playerId);

    var pos = this.getBornPoint(target); //获取目标场景出生点

    player.areaId = target;  //角色场景id为目标场景id
    player.isInTeamInstance = false;
    player.instanceId = 0;    //玩家副本id为0，无副本
    player.x = pos.x;
    player.y = pos.y;
    utils.myPrint("1 ~ player.teamId = ", player.teamId);
    //将玩家信息player同步到数据库。重置部分session【因为切换地图就是切换了后端服务器，需要修改session，是为了下次从前端指向正确的场景服务器】
    userDao.updatePlayer(player, function(err, success) {   
      if(err || !success) {
        err = err || 'update player failed!';
        utils.invokeCallback(cb, err);
      } else {
        session.set('areaId', target);
        session.set('serverId', app.get('areaIdMap')[target]);   //session的后端服务器id，这个是关键，决定切换到哪个后端服务器-------0
        session.set('teamId', player.teamId);
        session.set('isCaptain', player.isCaptain);
        session.set('isInTeamInstance', player.isInTeamInstance);
        session.set('instanceId', player.instanceId);
        session.pushAll(function(err) {
          if(err){
            logger.error('Change area for session service failed! error is : %j', err.stack);
          }
          utils.invokeCallback(cb, null);
          utils.myPrint("2 ~ player.teamId = ", player.teamId);
        });
      }
    });
  }else{
    //如果目标场景是单人副本或组队副本-----------------------------------------------------------------单人副本或组队副本
    var closure = this;   //闭包
    //异步串行（顺序执行数组函数，将每一个函数结果存入数组中）
    async.series([
      function(callback){
        //Construct params
        var params = {areaId : args.target};  //用于创建组队副本的参数params
        params.id = playerId;

        //如果目标场景类型为组队副本，而且玩家队伍id存在（即玩家进入组队副本）----------------组队副本多一个params.id
        if(targetInfo.type === AreaType.TEAM_INSTANCE && player.teamId){
          params.id = player.teamId;  //参数加入一个玩家队伍id
        }

        utils.myPrint('params.id, player.teamId = ', params.id, player.teamId);
        utils.myPrint('playerId = ', player.id);
        player.isInTeamInstance = true;  //玩家在组队副本true
        //Get target instance
        //rpc到副本脚本，生成目标场景（副本），并重置部分session-----------------------------------实例副本
        app.rpc.manager.instanceRemote.create(session, params, function(err, result){
          if(err){
            logger.error('get Instance error!');
            callback(err, 'getInstance');
          }else{
            session.set('instanceId', result.instanceId);
            session.set('serverId', result.serverId);      //session的后端服务器id，这个是关键，决定切换到哪个后端服务器-------0
            session.set('teamId', player.teamId);
            session.set('isCaptain', player.isCaptain);
            session.set('isInTeamInstance', player.isInTeamInstance);
            session.pushAll();
            player.instanceId = result.instanceId;   //玩家的副本id
            utils.myPrint('player.instanceId = ', player.instanceId);

            //如果玩家是队长，能获取到玩家队伍id，而且目标场景类型为组队副本
            if (player.isCaptain && player.teamId && targetInfo.type === AreaType.TEAM_INSTANCE) {
              utils.myPrint('DragMember2gameCopy is running ...');
              //rpc到组队脚本，
              app.rpc.manager.teamRemote.dragMember2gameCopy(null, {teamId: player.teamId, target: target},
                function(err, ret) {
                  if (!!err) {
                    logger.error(err, ret);
                  }
                });
            }

            callback(null);
          }
        });
      },
      function(cb){
        area.removePlayer(playerId);

        var pos = closure.getBornPoint(target);
        player.x = pos.x;
        player.y = pos.y;

        userDao.updatePlayer(player, function(err, success) {
          if(err || !success) {
            err = err || 'update player failed!';
            cb(err, 'update');
          }else {
            cb(null);
          }
        });
      }
    ],
      function(err, result){
        if(!!err){
          utils.invokeCallback(cb, err);      //如果发生错误，cb的值为err
          logger.warn('change area failed! args: %j', args);
        }else{
          utils.invokeCallback(cb, null);     //如果没错误，cb的值为null
        }
      }
    );
  }
};
