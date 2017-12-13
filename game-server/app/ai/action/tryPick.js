var bt = require('pomelo-bt');
var BTNode = bt.Node;
var util = require('util');
var consts = require('../../consts/consts');

//拾取道具动作
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
 * Try to invoke the pick the item.
 * 
 * @return {Number} bt.RES_SUCCESS if success to pick the item;
 *					bt.RES_FAIL if any fails and set distanceLimit to blackboard stands for beyond the item distance.
 */
pro.doAction = function() {
	var character = this.blackboard.curCharacter;
	// 当前锁定的目标id，是从黑板中获取
	// ps：blackboard.curTarget是由大脑player脚本的haveTarget赋值的，其if节点先条件赋值，再执行攻击节点
	var targetId = this.blackboard.curTarget;
	var area = this.blackboard.area;

	var target = area.getEntity(targetId);

	//如果目标实体不在场景中，解除目标，返回失败
	if(!target) {
		// target has disappeared
		this.blackboard.curTarget = null;
		if(targetId === character.target) {
			character.target = null;
		}
		return bt.RES_FAIL;
	}

	//如果黑板提供的目标id不同于角色锁定的目标id，或者场景获取的实体类型不是道具，也不是装备，解除目标，返回失败
	if(targetId !== character.target || (target.type !== consts.EntityType.ITEM && target.type !== consts.EntityType.EQUIPMENT)) {
		// if target changed or is not pickable
		this.blackboard.curTarget = null;
		return bt.RES_FAIL;
	}

	//场景目标是道具，执行角色的拾取道具函数（在条件中执行，并对结果进行判断：拾取成功、消失、背包满；都可以返回成功）
	var res = character.pickItem(target.entityId);
	if(res.result === consts.Pick.SUCCESS || 
		res.result === consts.Pick.VANISH ||
		res.result === consts.Pick.BAG_FULL) {
		this.blackboard.curTarget = null;
		character.target = null;
		return bt.RES_SUCCESS;
	}

	//拾取结果返回不在拾取返回内，返回失败
	if(res.result === consts.Pick.NOT_IN_RANGE) {
		this.blackboard.distanceLimit = res.distance;
	}
	
	return bt.RES_FAIL;
};
