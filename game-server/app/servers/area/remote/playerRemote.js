/**
 * Module dependencies 模块依赖
 */

var utils = require('../../../util/utils');
var userDao = require('../../../dao/userDao');
var bagDao = require('../../../dao/bagDao');
var taskDao = require('../../../dao/taskDao');
var equipmentsDao = require('../../../dao/equipmentsDao');
var consts = require('../../../consts/consts');
var areaService = require('../../../services/areaService');
var pomelo = require('pomelo');
var logger = require('pomelo-logger').getLogger(__filename);
var messageService = require('../../../domain/messageService');

var exp = module.exports;

/**
 * Player exits. It will persistent player's state in the database.
 * 玩家退出场景。将保存玩家的状态在数据库中。
 *
 * @param {Object} args
 * @param {Function} cb
 * @api public
 */
//掉线造成的被动离队--------------------------------------------------------------------------【掉线离队】
exp.playerLeave = function(args, cb){
  //玩家id为客户端发来参数的玩家id
  var playerId = args.playerId;
  //副本id获取副本
  var area = pomelo.app.areaManager.getArea(args.instanceId);  //如果是副本app.areaManager就是instancePool副本池管理
  //副本中获取玩家
  var player = area.getPlayer(playerId);

  utils.myPrint('1 ~ areaId = ', area.areaId);
  utils.myPrint('2 ~ instanceId = ', args.instanceId);
  utils.myPrint('3 ~ args = ', JSON.stringify(args));
  //如果获取不到，说明不在副本
  if(!player){
    logger.warn('player not in the area ! %j', args);
    utils.invokeCallback(cb);     //我把下面那行放这里，因为return前要有cb
    return;
  }
  //普通场景id
  var sceneId = player.areaId;

//  if(!player) {
//    utils.invokeCallback(cb);
//    return;
//  }

  var params = {playerId: playerId, teamId: player.teamId};
  //管理服务器让玩家退出团队
  pomelo.app.rpc.manager.teamRemote.leaveTeamById(null, params,
    function(err, ret) {
    });

  if(player.hp === 0){
    //玩家死了，复活为半血
    player.hp = Math.floor(player.maxHp/2);
  }

  //If player is in a instance, move to the scene
  //如果地图类型不是普通场景，玩家回到普通场景的出生点
  if(area.type !== consts.AreaType.SCENE){
    var pos = areaService.getBornPoint(sceneId);
    player.x = pos.x;
    player.y = pos.y;
  }

  //将修改过的玩家信息更新到数据库里面：玩家信息、背包、装备、任务
  userDao.updatePlayer(player);
  bagDao.update(player.bag);
  equipmentsDao.update(player.equipments);
  taskDao.tasksUpdate(player.curTasks);
  //副本删除玩家
  area.removePlayer(playerId);
  //副本推送消息给队员，该玩家已经离线
  area.channel.pushMessage({route: 'onUserLeave', code: consts.MESSAGE.RES, playerId: playerId});
  utils.invokeCallback(cb);
};


//退出团队，player.teamId归零  （1.队伍解散 2.玩家主动离队 3.掉线离队）-----------------------------------【player.teamId归零】
//（Team.disbandTeam调用该函数）（Team.removePlayer调用该函数）
//args参数为：[{ playerId: playerId, instanceId: arr[i].playerData.instanceId}]玩家id、副本id
exp.leaveTeam = function(args, cb){
  var playerId = args.playerId;
  //场景管理获取场景（如果当前是普通场景服务器是scene.getArea；如果当前是副本场景服务器则是instancePool.getArea）
  var area = pomelo.app.areaManager.getArea(args.instanceId);  
  var player = area.getPlayer(playerId);

  utils.myPrint('LeaveTeam ~ areaId = ', area.areaId);
  utils.myPrint('LeaveTeam ~ instanceId = ', args.instanceId);
  utils.myPrint('LeaveTeam ~ args = ', JSON.stringify(args));
  var err = null;
  if(!player){
    err = 'Player leave team error(no player in area)!';
    utils.invokeCallback(cb, err);
    return;
  }
  utils.myPrint('1 ~ LeaveTeam ~ playerId, player.teamId = ', playerId, player.teamId);

  //执行player离队函数-----------------------------------------------------------player.teamId归零
  if (!player.leaveTeam()) {
    err = 'Player leave team error!';
    utils.invokeCallback(cb, err);
    return;
  }

  utils.myPrint('2 ~ LeaveTeam ~ playerId, player.teamId = ', playerId, player.teamId);

  //广播aoi消息。通知附近的玩家，该玩家离队（显示：xxx离开了队伍）
  messageService.pushMessageByAOI(area,
    {
      route: 'onTeamMemberStatusChange',   //队员状态改变
      playerId: playerId,
      teamId: player.teamId,
      isCaptain: player.isCaptain,
      teamName: consts.TEAM.DEFAULT_NAME
    },
    {x: player.x, y: player.y}, {});

  utils.invokeCallback(cb);
};

