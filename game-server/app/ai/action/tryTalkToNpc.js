var bt = require('pomelo-bt');
var BTNode = bt.Node;
var util = require('util');
var consts = require('../../consts/consts');

/**
 * Try pick action.
 * 
 * @param opts {Object} {blackboard: blackboard}
 */
var Action = function(opts) {
	BTNode.call(this, opts.blackboard);
};
util.inherits(Action, BTNode);

module.exports = Action;

var pro = Action.prototype;

/**
 * Try to invoke the talk to npc action.
 * 
 * @return {Number} bt.RES_SUCCESS if success to talk to npc;
 *					bt.RES_FAIL if any fails and set distanceLimit to blackboard stands for beyond the npc distance.
 */
pro.doAction = function() {
	var character = this.blackboard.curCharacter;
	// 当前锁定的目标id，是从黑板中获取
	// ps：blackboard.curTarget是由大脑player脚本的haveTarget赋值的，其if节点先条件赋值，再执行攻击节点
	var targetId = this.blackboard.curTarget;
	var area = this.blackboard.area;

	//通过目标id，使用场景获取目标实体
	var target = area.getEntity(targetId);

	//如果目标实体不在场景中，解除目标，返回失败
	if(!target) {
		// if target has disappeared
		this.blackboard.curTarget = null;
		if(targetId === character.target) {
			character.target = null;
		}
		return bt.RES_FAIL;
	}

	//场景获得的目标实体类型不是npc，黑板解除目标，返回失败
	if(target.type !== consts.EntityType.NPC) {
		// target has changed
		this.blackboard.curTarget = null;
		return bt.RES_FAIL;
	}

	//确定目标是NPC后，执行目标的对话函数（在条件判断里面执行，并判断结果如果对话成功，返回成功）
	var res = target.talk(character);
	if(res.result === consts.NPC.SUCCESS) {
		this.blackboard.curTarget = null;
		character.target = null;
		return bt.RES_SUCCESS;
	}

	//执行对话结果返回值是没在距离范围内，返回失败
	if(res.result === consts.NPC.NOT_IN_RANGE) {
		this.blackboard.distanceLimit = res.distance;
	}
	
	return bt.RES_FAIL;
};
