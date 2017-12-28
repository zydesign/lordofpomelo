var TryAndAdjust = require('../node/tryAndAdjust');
var TryAttack = require('../action/tryAttack');
var MoveToTarget = require('../action/moveToTarget');
//var FindNearbyPlayer = require('../action/findNearbyPlayer');
var Patrol = require('../action/patrol');
var bt = require('pomelo-bt');
var Loop = bt.Loop;
var If = bt.If;
var Select = bt.Select;
var consts = require('../../consts/consts');

/**
 * Tiger brain.
 * Attack the target if have any.
 * Find the nearby target if have no target.
 * Begin to patrol if nothing to do.
 */

//怪物大脑
var Brain = function(blackboard) {
	this.blackboard = blackboard;
	//try attack and move to target action
	////先创建一个（尝试攻击或调整再攻击）节点（选择节点：tryAction>adjustAction）------------------------------2
	var attack = new TryAndAdjust({
		blackboard: blackboard, 
		//调整
		adjustAction: new MoveToTarget({
			blackboard: blackboard
		}), 
		//尝试攻击
		tryAction: new TryAttack({
			blackboard: blackboard, 
			getSkillId: function(bb) {
				return 1; //normal attack
			}
		})
	});

	//loop attack action
	//循环攻击的条件-------------------------------------------------------------------3
	var checkTarget = function(bb) {
		if(bb.curTarget !== bb.curCharacter.target) {
			// target has change
			bb.curTarget = null;
			return false;
		}

		return !!bb.curTarget;
	};

	//循环攻击节点
	var loopAttack = new Loop({
		blackboard: blackboard, 
		child: attack, 
		loopCond: checkTarget
	});

	//if have target then loop attack action
	//条件攻击的条件---------------------------------------------------------------------1
	var haveTarget = function(bb) {
		var character = bb.curCharacter;
		var targetId = character.target;
		var target = bb.area.getEntity(targetId);

		if(!target) {
			// target has disappeared
			character.forgetHater(targetId);
			bb.curTarget = null;
			return false;
		}

		//角色的属性target类型为玩家，返回true。条件攻击的条件就会成立，返回等待下一次update
		if(target.type === consts.EntityType.PLAYER) {
			bb.curTarget = targetId;  //将怪物的targetId属性写入黑板，提供给attack调用..................
			return true;
		}
		return false;
	};

	//条件攻击
	var attackIfHaveTarget = new If({
		blackboard: blackboard, 
		cond: haveTarget, 
		action: loopAttack
	});

	//find nearby target action
	//var findTarget = new FindNearbyPlayer({blackboard: blackboard});
	//patrol action
	//生成巡逻节点-------------------------------------------------------------------4
	var patrol = new Patrol({blackboard: blackboard});

	//composite them together
	this.action = new Select({
		blackboard: blackboard
	});

	//如果attackIfHaveTarget子节点的结果为失败，那么执行patrol子节点，会让aiManager去除该怪物的ai大脑，加入巡逻系统
	//直到aoi系统监听到玩家进入怪物视野攻击范围，才从巡逻系统转回ai系统
	this.action.addChild(attackIfHaveTarget);
	//this.action.addChild(findTarget);
	this.action.addChild(patrol);
};

var pro = Brain.prototype;

pro.update = function() {
	return this.action.doAction();
};

module.exports.clone = function(opts) {
	return new Brain(opts.blackboard);
};

module.exports.name = 'tiger';
