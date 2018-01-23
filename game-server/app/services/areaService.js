var dataApi = require('../util/dataApi');
var utils = require('../util/utils');
var pomelo = require('pomelo');
var userDao = require('../dao/userDao');
var taskDao = require('../dao/taskDao');
var Map = require('../domain/map/map');
var AreaType = require('../consts/consts').AreaType;
var async = require('async');

var logger = require('pomelo-logger').getLogger(__filename);

var maps = {};  //普通地图组

var exp = module.exports;

//场景服务初始化。设置场景权重，通过场景数据生成游戏地图组maps，Key为场景id（app启动立即调用该函数。这时是还没有场景的，只是提供了服务）
exp.init = function(){
  var areas = dataApi.area.all(); //获取场景数据数组

  //遍历场景数据组，设置权重，添加游戏地图
  for(var key in areas){
    //init map
    var area = areas[key];

    area.weightMap = false;
    //生成游戏地图组maps。key为area.id-----------------------------------------------生成游戏地图组maps
    maps[area.id] = new Map(area);  
  }
};

/**
 * Proxy for map, get born place for given map
 * @api public
 */
//生成出生地。通过指定场景id的游戏地图，获取出生地数据
exp.getBornPlace = function(sceneId){
  return maps[sceneId].getBornPlace();
};

/**
 * Proxy for map, get born point for given map
 * @api public
 */
//获取出生点。通过指定场景id的游戏地图，从出生地中生成出生点
exp.getBornPoint = function(sceneId){
  return maps[sceneId].getBornPoint();
};

/**
 * Change area, will transfer a player from one area to another
 * @param args {Object} The args for transfer area, the content is {playerId, areaId, target, frontendId}
 * @param cb {funciton} Call back funciton
 * @api public
 */
//切换场景。服务器处理完逻辑后，返回cb（null）（area.playerHandler.changeArea调用该函数，客户端发起切换场景使用）
//参数args：{areaId: areaId,target: target,uid: session.uid,playerId: playerId,frontendId: session.frontendId}
exp.changeArea = function(args, session, cb) {
  var app = pomelo.app;
  var area = session.area;
  var uid = args.uid;
  var playerId = args.playerId;
  var target = args.target;
  var player = area.getPlayer(playerId);
  var frontendId = args.frontendId;   

  //通过目标areaId，获取目标场景数据
  var targetInfo = dataApi.area.findById(target);

  //如果目标场景为普通场景。当前场景删除玩家，获取目标场景出生点，玩家属性直线目标场景---------------------------------普通场景
  if(targetInfo.type === AreaType.SCENE){
    area.removePlayer(playerId);            //当前场景删除玩家实体，调用area.removeEntity(entityId)

    var pos = this.getBornPoint(target);    //获取目标场景出生点

    player.areaId = target;                 //角色player.areaId设置为目标场景id
    player.isInTeamInstance = false;        //角色player.isInTeamInstance设置为不在副本里
    player.instanceId = 0;                  //角色player.instanceId设置为无副本
    player.x = pos.x;                       //角色坐标设置为目标地图出生点
    player.y = pos.y;
    utils.myPrint("1 ~ player.teamId = ", player.teamId);
    //玩家进入普通副本。将玩家信息player同步到数据库。
    //重置部分session【因为切换地图就是换了areaId、serverId等，需要修改session，是为了下次从前端指向正确的场景服务器】
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
    //异步串行（顺序执行数组函数，将每一个函数结果存入最后函数的数组中）==========================================================
    async.series([
      function(callback){
        //Construct params
        var params = {areaId : args.target};  //用于创建组队副本的参数params
        params.id = playerId;

        //如果目标场景类型为组队副本，而且玩家有队伍（即玩家进入组队副本）---------组队副本params.id为teamId。而单人副本params.id为playerId
        if(targetInfo.type === AreaType.TEAM_INSTANCE && player.teamId){
          params.id = player.teamId;  //参数加入一个玩家队伍id
        }

        utils.myPrint('params.id, player.teamId = ', params.id, player.teamId);
        utils.myPrint('playerId = ', player.id);
        player.isInTeamInstance = true;           //玩家player.isInTeamInstance设置为true
        //Get target instance
        //rpc到管理服务器，在指定的副本服务器中生成目标场景（副本），并重置部分session------------------------在副本服务器实例副本
        //rpc返回的result：{副本服务器id，副本id}
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
            player.instanceId = result.instanceId;      //玩家player.instanceId设置
            utils.myPrint('player.instanceId = ', player.instanceId);

            //如果玩家是队长，能获玩家的player.teamId，而且目标场景类型为组队副本------------------------------队长拉队员一起进副本
            if (player.isCaptain && player.teamId && targetInfo.type === AreaType.TEAM_INSTANCE) {
              utils.myPrint('DragMember2gameCopy is running ...');
              //rpc到管理服务器，将队员拉进副本（让管理服务器的队伍频道推送消息，让队员发请求area.playerHandler.changeArea）
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
        area.removePlayer(playerId);                //当前场景删除玩家实体，调用area.removeEntity(entityId)

        var pos = closure.getBornPoint(target);     //获取目标场景的出生点。
        player.x = pos.x;
        player.y = pos.y;

        userDao.updatePlayer(player, function(err, success) {    //将玩家信息player同步到数据库。
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
    );     //到这来都是 async.series的内容，也是切换目标场景为副本的内容==========================================================
  }
};
