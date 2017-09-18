var dataApi = require('../util/dataApi');
var utils = require('../util/utils');
var pomelo = require('pomelo');
var userDao = require('../dao/userDao');
var taskDao = require('../dao/taskDao');
var Map = require('../domain/map/map');
var AreaType = require('../consts/consts').AreaType;
var async = require('async');

var logger = require('pomelo-logger').getLogger(__filename);

var maps = {};

var exp = module.exports;

//入口为app，服务器开启即执行了这里的init，设置场景权重，为每个场景配置tiled maps地图，Key为场景id
exp.init = function(){
  var areas = dataApi.area.all(); //dataApi由app提供

  //Init areas
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
//加入tiled maps地图后，就可以通过场景id，获取tiled maps地图的  出生地
exp.getBornPlace = function(sceneId){
  return maps[sceneId].getBornPlace();
};

/**
 * Proxy for map, get born point for given map
 * @api public
 */
//通过场景id获取  tiled maps地图的 出生点
exp.getBornPoint = function(sceneId){
  return maps[sceneId].getBornPoint();
};

/**
 * Change area, will transfer a player from one area to another
 * @param args {Object} The args for transfer area, the content is {playerId, areaId, target, frontendId}
 * @param cb {funciton} Call back funciton
 * @api public
 */
//切换场景，更新session
exp.changeArea = function(args, session, cb) {
  var app = pomelo.app;
  var area = session.area;
  var uid = args.uid;
  var playerId = args.playerId;
  var target = args.target;
  var player = area.getPlayer(playerId);
  var frontendId = args.frontendId;

  //要切换的场景 对应的场景数据
  var targetInfo = dataApi.area.findById(target);

  if(targetInfo.type === AreaType.SCENE){
    area.removePlayer(playerId);

    var pos = this.getBornPoint(target); //获取目标场景出生点

    player.areaId = target;  //修改角色场景id为目标场景id
    player.isInTeamInstance = false;
    player.instanceId = 0;
    player.x = pos.x;
    player.y = pos.y;
    utils.myPrint("1 ~ player.teamId = ", player.teamId);
    userDao.updatePlayer(player, function(err, success) {   //将更新的角色信息同步到数据库
      if(err || !success) {
        err = err || 'update player failed!';
        utils.invokeCallback(cb, err);
      } else {
        session.set('areaId', target);
        session.set('serverId', app.get('areaIdMap')[target]);
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
    var closure = this;
    async.series([
      function(callback){
        //Construct params
        var params = {areaId : args.target};
        params.id = playerId;

        if(targetInfo.type === AreaType.TEAM_INSTANCE && player.teamId){
          params.id = player.teamId;
        }

        utils.myPrint('params.id, player.teamId = ', params.id, player.teamId);
        utils.myPrint('playerId = ', player.id);
        player.isInTeamInstance = true;
        //Get target instance
        app.rpc.manager.instanceRemote.create(session, params, function(err, result){
          if(err){
            logger.error('get Instance error!');
            callback(err, 'getInstance');
          }else{
            session.set('instanceId', result.instanceId);
            session.set('serverId', result.serverId);
            session.set('teamId', player.teamId);
            session.set('isCaptain', player.isCaptain);
            session.set('isInTeamInstance', player.isInTeamInstance);
            session.pushAll();
            player.instanceId = result.instanceId;
            utils.myPrint('player.instanceId = ', player.instanceId);

            if (player.isCaptain && player.teamId && targetInfo.type === AreaType.TEAM_INSTANCE) {
              utils.myPrint('DragMember2gameCopy is running ...');
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
          utils.invokeCallback(cb, err);
          logger.warn('change area failed! args: %j', args);
        }else{
          utils.invokeCallback(cb, null);
        }
      }
    );
  }
};
