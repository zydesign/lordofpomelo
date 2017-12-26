var bt = require('pomelo-bt');
var BTNode = bt.Node;
var util = require('util');
var formula = require('../../consts/formula');
var consts = require('../../consts/consts');

//该节点用于拾取道具和与NPC对话，调整攻击距离，移动角色靠近目标
var Action = function(opts) {
	BTNode.call(this, opts.blackboard);
};
util.inherits(Action, BTNode);

module.exports = Action;

var pro = Action.prototype;

/**
 * Move the character to the target.
 *
 * @return {Number} bt.RES_SUCCESS if the character already next to the target;
 *					bt.RES_WAIT if the character need to move to the target;
 *					bt.RES_FAIL if any fails
 */
pro.doAction = function() {
	var character = this.blackboard.curCharacter;
	var targetId = this.blackboard.curTarget;
	var distance = this.blackboard.distanceLimit || 200;
	var target = this.blackboard.area.getEntity(targetId);

	//场景获取不到实体，角色放弃锁定目标，返回失败
	if(!target) {
		// target has disappeared or died
		character.forgetHater(targetId);
		return bt.RES_FAIL;
	}

	//黑板目标与角色锁定的目标不一致，目标改变了，重置黑板部分属性，返回失败
	if(targetId !== character.target) {
		//target has changed
		this.blackboard.curTarget = null;
		this.blackboard.distanceLimit = 0;
		this.blackboard.targetPos = null;
		this.blackboard.moved = false;
		return bt.RES_FAIL;
	}

	//计算出角色与目标在限制范围内，执行停止移动，调整距离完成，返回成功...............
	if(formula.inRange(character, target, distance)) {
		this.blackboard.area.timer.abortAction('move', character.entityId);
		this.blackboard.distanceLimit = 0;
		this.blackboard.moved = false;
		return bt.RES_SUCCESS;
	}

	if(character.type === consts.EntityType.MOB) {
		//怪物坐标离怪物初始坐标超过500，就要放弃仇恨，返回失败
		if(Math.abs(character.x - character.spawnX) > 500 ||
			Math.abs(character.y - character.spawnY) > 500) {
			//we move too far and it is time to turn back
			character.forgetHater(targetId);
			this.blackboard.moved = false;
			return bt.RES_FAIL;
		}
	}


	var targetPos = this.blackboard.targetPos;
	var closure = this;

	//获取目标后，目标远离拾取或对话范围，如果黑板停止移动，则执行角色移动函数，返回等待
	if(!this.blackboard.moved){
		character.move(target.x, target.y, false, function(err, result){
			if(err || result === false){
				closure.blackboard.moved = false;
				character.target = null;
			}
		});

		this.blackboard.targetPos = {x: target.x, y : target.y};
		this.blackboard.moved = true;
	//如果黑板移动过了，判断黑板目标坐标存在，而且实体目标改变位置了
	} else if(targetPos && (targetPos.x !== target.x || targetPos.y !== target.y)) {
		//黑板目标与实体目标距离
		var dis1 = formula.distance(targetPos.x, targetPos.y, target.x, target.y);
		//角色与实体目标距离
		var dis2 = formula.distance(character.x, character.y, target.x, target.y);

		//target position has changed
		//如果实体离目标较远，或者黑板停止移动，获取实时目标坐标，并继续移动角色
		if(((dis1 * 3 > dis2) && (dis1 < distance)) || !this.blackboard.moved){
			targetPos.x = target.x;
			targetPos.y = target.y;

			character.move(target.x, target.y, false, function(err, result){
				if(err || result === false){
					closure.blackboard.moved = false;
					character.target = null;
				}
			});
		}
	}
	//返回等待是让角色靠近目标，如果足够靠近目标后，上面有判断是否在范围内，如果在将返回成功
	return bt.RES_WAIT;
};

module.exports.create = function() {
	return Action;
};
