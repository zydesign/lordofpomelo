var bt = require('pomelo-bt');
var BTNode = bt.Node;
var util = require('util');
var consts = require('../../consts/consts');

/**
 * Try attack action.
 *
 * @param opts {Object} {blackboard: blackboard, getSkillId: get skill id cb}
 */
//加入属性：黑板、技能id
var Action = function(opts) {
	BTNode.call(this, opts.blackboard);
	this.getSkillId = opts.getSkillId;
};
util.inherits(Action, BTNode);

module.exports = Action;

var pro = Action.prototype;

/**
 * Try to invoke the attack skill that returned by getSkillId callback.
 *
 * @return {Number} bt.RES_SUCCESS if success to invoke the skill;
 *					bt.RES_FAIL if any fails and set distanceLimit to blackboard stands for beyond the skill distance.
 */
pro.doAction = function() {
	var character = this.blackboard.curCharacter;
	// 当前锁定的目标id，是从黑板中获取
	// ps：blackboard.curTarget是由大脑player脚本的haveTarget赋值的，其if节点先条件赋值，再执行攻击节点
	var targetId = this.blackboard.curTarget;

	//通过目标id，使用场景获取目标实体
	var target = this.blackboard.area.getEntity(targetId);

	//如果目标实体不在场景中，解除目标，返回失败
	if(!target) {
		// target has disappeared or died
		//去除黑板的目标id
		this.blackboard.curTarget = null;
		//如果之前的黑板目标id跟角色锁定的目标id一致，角色的目标id也要去除
		if(targetId === character.target) {
			character.forgetHater(targetId);
		}
		return bt.RES_FAIL;
	}

	//如果黑板提供的目标id不同于角色锁定的目标id，说明目标改变了，不能攻击，应该返回失败
	if(targetId !== character.target) {
		//if target change abort current attack and try next action
		this.blackboard.curTarget = null;
		return bt.RES_FAIL;
	}

	//场景获得的目标实体既不是怪物也不是玩家，（可能是道具），也不能攻击，返回失败
	if(target.type !== consts.EntityType.MOB &&
		target.type !== consts.EntityType.PLAYER){
		return bt.RES_FAIL;
	}

	//上面条件都避开了，那就允许攻击，角色执行攻击函数，并发射“attack”事件（在条件判断里面执行了）
	var res = character.attack(target, this.getSkillId(this.blackboard));

	//攻击返回了结果符合条件，返回成功
	if(res.result === consts.AttackResult.SUCCESS ||
		res.result === consts.AttackResult.KILLED ||
		res.result === consts.AttackResult.MISS ||
		res.result === consts.AttackResult.NOT_COOLDOWN) {

		return bt.RES_SUCCESS;
	}

	//攻击返回结果没在攻击范围，将攻击距离写入黑板，提供给moveToTarget使用，返回失败
	if(res.result === consts.AttackResult.NOT_IN_RANGE) {
		this.blackboard.distanceLimit = res.distance;
	}

	return bt.RES_FAIL;
};
