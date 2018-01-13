var TryAndAdjust = require('../node/tryAndAdjust');     //尝试调整节点
var TryAttack = require('../action/tryAttack');         //尝试攻击节点
var TryPick = require('../action/tryPick');             //尝试拾取节点
var TryTalkToNpc = require('../action/tryTalkToNpc');   //尝试与NPC对话节点
var MoveToTarget = require('../action/moveToTarget');   //移动到目标位置节点
var bt = require('pomelo-bt');
var Loop = bt.Loop;
var If = bt.If;
var Select = bt.Select;
var consts = require('../../consts/consts');

//玩家大脑，是一个选择节点：攻击>拾取>对话npc

/**
 * Auto fight brain.
 * Attack the target if have any.
 * Choose the 1st skill in fight skill list or normal attack by defaul.
 * 如果有目标则，选择第一个技能或默认技能自动攻击
 */

//参数blackboard是来源于brainService.getBrain(type, blackboard)，而这个黑板blackboard又是由aiManager.addCharacters（cs）创建的
var Brain = function(blackboard) {
	var attack = genAttackAction(blackboard);      //生成攻击行为
	var pick = genPickAction(blackboard);          //生成拾取行为
	var talkToNpc = genNpcAction(blackboard);      //生成对话NPC行为

	//实例一个选择节点，优先顺序 攻击>拾取>对话npc
	var action = new Select({
		blackboard: blackboard
	});

	action.addChild(attack);        //Target类型为mob或player时--------------------------------------------
	action.addChild(pick);          //Target类型为item时
	action.addChild(talkToNpc);     //Target类型为npc时

	//composite them together
	this.action = action;
};

var pro = Brain.prototype;

//大脑的更新行为
pro.update = function() {
	return this.action.doAction();
};

//生成攻击
var genAttackAction = function(blackboard) {
	//try attack and move to target action
	
	//先创建一个（尝试攻击或调整再攻击）节点（选择节点：tryAction>adjustAction）
	var attack = new TryAndAdjust({
		blackboard: blackboard, 
		//调整
		adjustAction: new MoveToTarget({
			blackboard: blackboard
		}), 
		//攻击
		tryAction: new TryAttack({
			blackboard: blackboard, 
			
			//技能id这个属性并没有被用到
			getSkillId: function(bb) {
				//return current skill or normal attack by default
				return bb.curCharacter.curSkill || 1;
			}
		})
	});

	//loop attack action
	//循环条件（因为是循环节点的条件，所以bb会先被替换成this.blackboard才会被执行，并将checkTarge（blackboard）的结果作为条件判断）
	//该循环条件的目的：判断角色的target是否还是当前的target
	var checkTarget = function(bb) {
		//如果黑板target不匹配角色target，说明角色target实时改变了，黑板的target要清空，返回false作为条件
		if(bb.curTarget !== bb.curCharacter.target) {
			// target has change
			bb.curTarget = null;
			return false;
		}

		//如果黑板目标匹配角色绑定目标，返回结果为黑板目标，也就是循环条件成立------------------bt.RES_WAIT，可以循环攻击 
		return !!bb.curTarget;
	};
         
	//这个是主节点的子节点，第二优先执行........................................2
	//循环节点（循环节点让条件checkTarget（bb）变成了checkTarget（this.blackboard），即参数bb改成了this.blackboard）
	//循环节点顺序（先子节点，再循环条件）
	var loopAttack = new Loop({
		blackboard: blackboard, 
		child: attack, 
		loopCond: checkTarget
	});

	
	//if have target then loop attack action
	//这个主节点的条件，作为条件节点的条件参数，第一优先被执行.被创建成condition条件节点........................................1
	//这个bb也是先被替换成了this.blackboard，而执行haveTarget (blackboard)作为条件判断
	var haveTarget = function(bb) {
		var character = bb.curCharacter;
		var targetId = character.target;
		var target = bb.area.getEntity(targetId);

		//如果场景实体不存在，放弃目标，返回false，主节点条件不成立
		if(!target) {
			// target has disappeared
			character.forgetHater(targetId);
			bb.curTarget = null;
			return false;
		}

		//如果场景实体类型是怪物或玩家，返回true，主节点的条件节点成立------------------bt.RES_SUCCESS
		if(target.type === consts.EntityType.MOB || 
			target.type === consts.EntityType.PLAYER) {
			bb.curTarget = targetId;   //将角色属性的targetid写入黑板上
			return true;
		}
		//场景实体类型是道具或装备，返回false，主节点的条件节点不成立
		return false;
	};

	//最终主节点，条件节点（也是顺序节点，先条件，再子节点）...................................0
	return new If({
		blackboard: blackboard, 
		cond: haveTarget, 
		action: loopAttack
	});
};

//生成拾取
var genPickAction = function(blackboard) {
	//try pick and move to target action
	//先创建一个（尝试拾取或调整再拾取）节点（选择节点：tryAction>adjustAction）
	var pick = new TryAndAdjust({
		blackboard: blackboard, 
		adjustAction: new MoveToTarget({
			blackboard: blackboard
		}), 
		tryAction: new TryPick({
			blackboard: blackboard 
		})
	});

	//if have target then pick it
	//条件拾取的条件
	var haveTarget = function(bb) {
		var character = bb.curCharacter;
		var targetId = character.target;
		var target = bb.area.getEntity(targetId);

		//如果目标不存在
		if(!target) {
			// target has disappeared
			character.forgetHater(targetId);
			bb.curTarget = null;
			return false;
		}

		//检测目标实体类型是否为装备或道具
		if(consts.isPickable(target)) {
			bb.curTarget = targetId;  //将角色的属性target写入黑板，提供给pick拾取函数引用---------------
			return true;
		}
		return false;
	};

	return new If({
		blackboard: blackboard, 
		cond: haveTarget, 
		action: pick
	});
};

var genNpcAction = function(blackboard) {
	//try talk and move to target action0
	//先创建一个（尝试对话或调整再对话）节点（选择节点：tryAction>adjustAction）
	var talk = new TryAndAdjust({
		blackboard: blackboard, 
		adjustAction: new MoveToTarget({
			blackboard: blackboard
		}), 
		tryAction: new TryTalkToNpc({
			blackboard: blackboard 
		})
	});

	//if have target then pick it
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

		//如果目标类型为NPC
		if(target.type === consts.EntityType.NPC) {
			bb.curTarget = targetId;      //将角色的属性target写入黑板，提供给talk对话函数引用---------------
			return true;
		}
		return false;
	};

	return new If({
		blackboard: blackboard, 
		cond: haveTarget, 
		action: talk
	});
};

module.exports.clone = function(opts) {
	return new Brain(opts.blackboard);
};

module.exports.name = 'player';
