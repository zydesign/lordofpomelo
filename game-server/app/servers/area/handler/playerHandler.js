/**
 * Module dependencies
 * 依赖的模块
 */
var messageService = require('../../../domain/messageService');
var areaService = require('../../../services/areaService');
var userDao = require('../../../dao/userDao');
var bagDao = require('../../../dao/bagDao');
var equipmentsDao = require('../../../dao/equipmentsDao');
var taskDao = require('../../../dao/taskDao');
var Move = require('../../../domain/action/move');
var actionManager = require('../../../domain/action/actionManager');
var logger = require('pomelo-logger').getLogger(__filename);
var pomelo = require('pomelo');
var consts = require('../../../consts/consts');
var dataApi = require('../../../util/dataApi');
var channelUtil = require('../../../util/channelUtil');
var utils = require('../../../util/utils');

var handler = module.exports;

/**
 * Player enter scene, and response the related information such as
 * playerInfo, areaInfo and mapData to client.
 *玩家进入场景，并响应相关信息：playerInfo,areaInfo和mapData到客户端。
 *
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */

//进入场景  （客户端没有提供msg）
handler.enterScene = function(msg, session, next) {
  var area = session.area;
  var playerId = session.get('playerId');
  var areaId = session.get('areaId');
	var teamId = session.get('teamId') || consts.TEAM.TEAM_ID_NONE;
	var isCaptain = session.get('isCaptain');
	var isInTeamInstance = session.get('isInTeamInstance');
	var instanceId = session.get('instanceId');
	utils.myPrint("1 ~ EnterScene: areaId = ", areaId);
	utils.myPrint("1 ~ EnterScene: playerId = ", playerId);
	utils.myPrint("1 ~ EnterScene: teamId = ", teamId);

	//通过玩家id，获取角色信息全部信息
  userDao.getPlayerAllInfo(playerId, function(err, player) {
	  //如果发生错误或获取不到角色信息
    if (err || !player) {
      logger.error('Get user for userDao failed! ' + err.stack);
      next(new Error('fail to get user from dao'), {
        route: msg.route,
        code: consts.MESSAGE.ERR
      });

      return;
    }
                //修改部分角色信息为当前session信息
    player.serverId = session.frontendId;      //场景添加玩家实体的getChannel().add(e.userId, e.serverId)用到。
		player.teamId = teamId;
		player.isCaptain = isCaptain;
		player.isInTeamInstance = isInTeamInstance;
		player.instanceId = instanceId;
		areaId = player.areaId;
		utils.myPrint("2 ~ GetPlayerAllInfo: player.instanceId = ", player.instanceId);

	  //rpc到聊天服务器，让玩家加入聊天服务器
    pomelo.app.rpc.chat.chatRemote.add(session, session.uid,
			player.name, channelUtil.getAreaChannelName(areaId), null);
		var map = area.map;

    // temporary code
    //Reset the player's position if current pos is unreachable
	  //如果玩家坐标不可走，在出生地附近重置玩家坐标
		if(!map.isReachable(player.x, player.y)) {
    // {
			//通过map游戏地图生成出生点
			var pos = map.getBornPoint();
			player.x = pos.x;
			player.y = pos.y;
		}
    // temporary code

	  //用于返回给客户端的信息
		var data = {
        entities: area.getAreaInfo({x: player.x, y: player.y}, player.range),  //玩家视野范围的实体
        curPlayer: player.getInfo(),         //玩家状态信息（获取角色属性、背包信息、装备信息、战斗技能、当前任务）
        map: {                               //地图信息
          name : map.name,
          width: map.width,
          height: map.height,
          tileW : map.tileW,
          tileH : map.tileH,
          weightMap: map.collisions
        }
    };
		// utils.myPrint("1.5 ~ GetPlayerAllInfo data = ", JSON.stringify(data));
		next(null, data);     //将基础数据传输给客户端

		utils.myPrint("2 ~ GetPlayerAllInfo player.teamId = ", player.teamId);
		utils.myPrint("2 ~ GetPlayerAllInfo player.isCaptain = ", player.isCaptain);
	  //执行场景添加实体player
	  //如果玩家添加到场景失败（player不存在或player已经加入场景），再次传输数据给客户端，错误码
	  //执行场景添加玩家实体...........................................................................场景添加玩家实体
		if (!area.addEntity(player)) {
      logger.error("Add player to area faild! areaId : " + player.areaId);
      next(new Error('fail to add user into area'), {
       route: msg.route,
       code: consts.MESSAGE.ERR
      });
      return;    //如果场景不能加玩家，直接返回，不执行下面
    }

	  //如果玩家有队伍，rpc到队伍服务器更新队伍信息
		if (player.teamId > consts.TEAM.TEAM_ID_NONE) {
			// send player's new info to the manager server(team manager)
			var memberInfo = player.toJSON4TeamMember();
			//app.getServerId()在哪个服务器执行获取的就是那个服务器的id--------------------------------
			memberInfo.backendServerId = pomelo.app.getServerId();   
			pomelo.app.rpc.manager.teamRemote.updateMemberInfo(session, memberInfo,
				function(err, ret) {
				});
		}

  });
};

/**
 * Change player's view.
 * 改变玩家视野（观察者信息）
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */
//改变玩家视野
handler.changeView = function(msg, session, next){
  var timer = session.area.timer;

	var playerId = session.get('playerId');
	var width = msg.width;
	var height = msg.height;

	var radius = width>height ? width : height;  //半径取值

	var range = Math.ceil(radius / 600);         //转换为灯塔范围
	var player = session.area.getPlayer(playerId);

	if(range < 0 || !player){
		next(new Error('invalid range or player'));
		return;
	}

	//更新玩家aoi对象位置，推送消息给自己，哪些实体看见与看不见
	
	//如果玩家自身的范围不等于客户端提供的范围，原地更新观察者视野
	if(player.range !== range){
    timer.updateWatcher({id:player.entityId, type:player.type}, player, player, player.range, range);
		player.range = range;
	}

	next();
};

/**
 * Player moves. Player requests move with the given movePath.
 * Handle the request from client, and response result to client
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */
//客户端点击地面，发起移动请求。
handler.move = function(msg, session, next) {
  var area = session.area;
  var timer = area.timer;

  var path = msg.path;   //玩家坐标到点击位置坐标，生成的寻路路径
  var playerId = session.get('playerId');
  var player = area.getPlayer(playerId);
  var speed = player.walkSpeed;

  player.target = null;

   //如果验证路径有不可走的坐标，返回错误码
  if(!area.map.verifyPath(path)){
    logger.warn('The path is illegal!! The path is: %j', msg.path);
    next(null, {
      route: msg.route,
      code: consts.MESSAGE.ERR
    });

    return;
  }

  //如果路径没问题，生成移动动作
  var action = new Move({
    entity: player,
    path: path,
    speed: speed
  });

	var ignoreList = {};
	//将玩家自己加入aoi广播的排除组里。就是为了推送消息给除了自己以外的玩家观察者
	ignoreList[player.userId] = true;
	//动作加入动作管理器，方便update
  if (timer.addAction(action)) {
			player.isMoving = true;
			//Update state
	                //玩家离开原坐标就是移动了，aoi更新对象，更新观察者（会同时发射对应事件'update'和'updateWatcher'）
			if(player.x !== path[0].x || player.y !== path[0].y){
					timer.updateObject({id:player.entityId, type:consts.EntityType.PLAYER}, {x : player.x, y : player.y}, path[0]);
          timer.updateWatcher({id:player.entityId, type:consts.EntityType.PLAYER}, {x : player.x, y : player.y}, path[0], player.range, player.range);
			}
     //同时广播aoi消息自己位置的灯塔的观察者（排除自己）【消息有玩家id、路径和移动速度，客户端‘播放’玩家在路径上移动到目标点】
      messageService.pushMessageByAOI(area, {
      route: 'onMove',
      entityId: player.entityId,
      path: path,
      speed: speed
    }, path[0], ignoreList);
    next(null, {
      route: msg.route,
      code: consts.MESSAGE.RES
    });

    // next();
  }
  next(null, {});
};

//drop equipment or item
//客户端发起，玩家掉落道具或装备（PK掉落）
handler.dropItem = function(msg, session, next) {
  var player = session.area.getPlayer(session.get('playerId'));

  player.bag.removeItem(msg.index);

  next(null, {status: true});
};

//add equipment or item
//客户端发起，玩家拾取道具
handler.addItem = function(msg, session, next) {
  var player = session.area.getPlayer(session.get('playerId'));

  var bagIndex = player.bag.addItem(msg.item);

  next(null, {bagIndex: bagIndex});
};

//Change area
//客户端发起，玩家切换场景
handler.changeArea = function(msg, session, next) {
	var playerId = session.get('playerId');
	var areaId = msg.areaId;
	var target = msg.target;

	utils.myPrint('areaId, target = ', areaId, target);
	//如果所在场景为目标场景，返回false码
	if (areaId === target) {
		next(null, {success: false});
		return;
	}
	utils.myPrint('playerId = ', playerId);
	var player = session.area.getPlayer(playerId);
	//如果所在场景获取不到玩家，返回false码
	if (!player) {
		next(null, {success: false});
		return;
	}

  // save player's data immediately
  userDao.updatePlayer(player);              //更新player数据库中数据
  bagDao.update(player.bag);                 //更新bag数据库中数据
  equipmentsDao.update(player.equipments);   //更新equipments数据库中数据
  taskDao.tasksUpdate(player.curTasks);      //更新task数据库中数据

	var teamId = player.teamId;
	var isCaptain = player.isCaptain;

	var req = {
    areaId: areaId,
    target: target,
    uid: session.uid,
    playerId: playerId,
    frontendId: session.frontendId
  };

	utils.myPrint('teamId, isCaptain = ', teamId, isCaptain);
	utils.myPrint('msg.triggerByPlayer = ', msg.triggerByPlayer);
  utils.myPrint('changeArea is running ...');
	//通过场景服务切换场景
  areaService.changeArea(req, session, function(err) {
    var args = {areaId: areaId, target: target, success: true};
    next(null, args);
  });
};

//Use item
//客户端发起，玩家使用道具
handler.useItem = function(msg, session, next) {
  var player = session.area.getPlayer(session.get('playerId'));

	//index是背包栏第几格
  var status = player.useItem(msg.index);

  next(null, {code: consts.MESSAGE.RES, status: status});
};

//客户端发起，玩家对话npc，添加target，ai系统自动执行npc行为
handler.npcTalk = function(msg, session, next) {
  var player = session.area.getPlayer(session.get('playerId'));
  player.target = msg.targetId;
  next();
};

/**
 * Player pick up item.
 * Handle the request from client, and set player's target
 *
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */
//客户端发起，玩家拾取道具。添加target，ai系统自动执行拾取行为
handler.pickItem = function(msg, session, next) {
  var area = session.area;

  var player = area.getPlayer(session.get('playerId'));
  var target = area.getEntity(msg.targetId);
  if(!player || !target || (target.type !== consts.EntityType.ITEM && target.type !== consts.EntityType.EQUIPMENT)){
    next(null, {
      route: msg.route,
      code: consts.MESSAGE.ERR
    });
    return;
  }

  player.target = target.entityId;

  // next();
  next(null, {});
};

//Player  learn skill
//客户端发起，玩家学习技能
handler.learnSkill = function(msg, session, next) {
  var player = session.area.getPlayer(session.get('playerId'));
  var status = player.learnSkill(msg.skillId);

  next(null, {status: status, skill: player.fightSkills[msg.skillId]});
};

//Player upgrade skill
//客户端发起，玩家升级技能
handler.upgradeSkill = function(msg, session, next) {
  var player = session.area.getPlayer(session.get('playerId'));
  var status = player.upgradeSkill(msg.skillId);

  next(null, {status: status});
};
