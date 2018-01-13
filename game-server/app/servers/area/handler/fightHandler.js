/**
 * Module dependencies
 */
var handler = module.exports;
var consts = require('../../../consts/consts');
var logger = require('pomelo-logger').getLogger(__filename);
var Fightskill = require('../../../util/dataApi').fightskill;
var Code = require('../../../../../shared/code');
/**
 * Action of attack.
 * Handle the request from client, and response result to client
 * if error, the code is consts.MESSAGE.ERR. Or the code is consts.MESSAGE.RES
 *
 * @param {Object} msg
 * @param {Object} session
 * @api public
 */
//客户端请求，发起攻击。服务器器处理完数据，伤害数据发给aoi附近的人包括自己，【返回空对象{}给客户端】，不需要单独操作。有aoi监听
handler.attack = function(msg, session, next) {
	var player = session.area.getPlayer(session.get('playerId'));
	var target = session.area.getEntity(msg.targetId);

	if(!target || !player || (player.target === target.entityId) || (player.entityId === target.entityId) || target.died){
		// next();
    next(null, {});
		return;
	}

	//时间器停止玩家移动行为
	session.area.timer.abortAction('move', player.entityId);
	//只需给角色添加目标，ai系统就会获取目标，自动循环攻击
	player.target = target.entityId;

	// next();
  next(null, {});
};

/**
 * Player attacks his target with the skill.
 * Handle the request from client, and response result to client
 * if target exists, move to player.attack, or return.
 *
 * @param {Object} msg
 * @param {Object} session
 * @api public
 */
//客户端发起，使用技能。【无需返回消息给客户端】
handler.useSkill = function(msg, session, next) {
	var playerId = msg.playerId;
	var skillId = msg.skillId;
	var player = session.area.getPlayer(msg.playerId);
	var target = session.area.getEntity(player.target);
	if (!target || (target.type !== consts.EntityType.PLAYER && target.type !== consts.EntityType.MOB)) {
		next();
		return;
	}

	next();  //无需返回客户端
	player.attack(target, skillId);     //执行玩家攻击函数
};


