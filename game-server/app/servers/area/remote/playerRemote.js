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
exp.playerLeave = function(args, cb){
  //玩家id为客户端发来参数的玩家id
  var playerId = args.playerId;
  //通过区域管理器获取区域
  var area = pomelo.app.areaManager.getArea(args.instanceId);
  //再通过区域来获取玩家信息
  var player = area.getPlayer(playerId);

  utils.myPrint('1 ~ areaId = ', area.areaId);
  utils.myPrint('2 ~ instanceId = ', args.instanceId);
  utils.myPrint('3 ~ args = ', JSON.stringify(args));
  if(!player){
    logger.warn('player not in the area ! %j', args);
    return;
  }
  //玩家登录的场景id
  var sceneId = player.areaId;

  if(!player) {
    utils.invokeCallback(cb);
    return;
  }

  var params = {playerId: playerId, teamId: player.teamId};
  //管理服务器让玩家退出团队
  pomelo.app.rpc.manager.teamRemote.leaveTeamById(null, params,
    function(err, ret) {
    });

  if(player.hp === 0){
    //玩家死了，默认为半条血
    player.hp = Math.floor(player.maxHp/2);
  }

  //If player is in a instance, move to the scene
  //如果玩家在地图实例中，则移动到该地图出生地
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
  //区域地图移除玩家
  area.removePlayer(playerId);
  //区域地图广播信息给该地图的其他玩家，该玩家已经离线
  area.channel.pushMessage({route: 'onUserLeave', code: consts.MESSAGE.RES, playerId: playerId});
  utils.invokeCallback(cb);
};


//退出团队
exp.leaveTeam = function(args, cb){
  var playerId = args.playerId;
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

  if (!player.leaveTeam()) {
    err = 'Player leave team error!';
    utils.invokeCallback(cb, err);
    return;
  }

  utils.myPrint('2 ~ LeaveTeam ~ playerId, player.teamId = ', playerId, player.teamId);

  //通过灯塔广播消息给同队伍里面的附近玩家
  messageService.pushMessageByAOI(area,
    {
      route: 'onTeamMemberStatusChange',
      playerId: playerId,
      teamId: player.teamId,
      isCaptain: player.isCaptain,
      teamName: consts.TEAM.DEFAULT_NAME
    },
    {x: player.x, y: player.y}, {});

  utils.invokeCallback(cb);
};

