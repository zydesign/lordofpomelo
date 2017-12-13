var bt = require('pomelo-bt');
var BTNode = bt.Node;
var Sequence = bt.Sequence;
var Select = bt.Select;
var util = require('util');

//尝试攻击并调整攻击节点，是一个选择节点
/**
 * Try and adjust action.
 * Try to do a action and return success if the action success.
 * If fail then do the adjustment and try it again when adjust return success.
 *
 * @param opts {Object} 
 *				opts.blackboard {Object} blackboard
 *				opts.adjustAction {BTNode} adjust action
 *				opts.tryAction {BTNode} try action}
 */


//opt参数提供属性：blackboard、tryAction、adjustAction（MoveToTarget）
var Node = function(opts) {
	BTNode.call(this, opts.blackboard);

	//调整再攻击（顺序节点）
	var adjustAndTryAgain = new Sequence(opts);
	adjustAndTryAgain.addChild(opts.adjustAction);
	adjustAndTryAgain.addChild(opts.tryAction);

	//主节点，，，尝试攻击并调整再攻击（选择节点）
	var tryAndAdjust = new Select(opts);
	tryAndAdjust.addChild(opts.tryAction);
	tryAndAdjust.addChild(adjustAndTryAgain);

	this.action = tryAndAdjust;
};
util.inherits(Node, BTNode);

module.exports = Node;

var pro = Node.prototype;

pro.doAction = function() {
	return this.action.doAction();
};
