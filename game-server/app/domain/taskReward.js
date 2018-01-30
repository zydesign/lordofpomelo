/**
 * Module dependencies
 */
var Item = require('./entity/item');
var Equipment = require('./entity/equipment');
var dataApi = require('../util/dataApi');
var messageService = require('./messageService');

/**
 * Expose 'taskReward'
 */
//任务奖励
var taskReward = module.exports;

/**
 * Player get rewards after task is completed.
 * the rewards contain equipments and exprience, according to table of figure
 *
 * @param {Player} player
 * @param {Array} ids
 * @api public
 */

//奖赏。参数ids为完成未发送状态的task.id数组
taskReward.reward = function(area, player, ids) {
	if (ids.length < 1) {
		return;
	}

	var i, l;
	var tasks = player.curTasks;           //玩家的已接任务
	var pos = player.getState();           //基类entity的函数，获取角色实体坐标
	var totalItems = [], totalExp = 0;     //奖赏的总装备物品（这里的道具id都是装备种类id）和总经验

	//遍历已完成任务id组，获取累计到总装备物品totalItems和总经验totalExp中-----------------------------累计奖赏（总装备物品id、总经验）
	for (i = 0, l=ids.length; i < l; i++) {
		var id = ids[i];
		var task = tasks[id];
		
		//split() 方法用于把一个字符串分割成字符串数组
		//根据分号分割字符串为两段（如："1;25"变成["1","25"]）
		var items = task.item.split(';');   //装备物品id数组（是kindId）
		var exp = task.exp;                 //奖赏的经验
		//遍历道具id数组，将道具id存入totalItems数组
		for (var j = 0; j < items.length; j++) {
			totalItems.push(items[j]);
		}
		totalExp += exp;
	}

	//通过总装备物品id），生成equipment实体组
	var equipments = this._rewardItem(totalItems, pos);
	//执行角色获得经验值
	this._rewardExp(player, totalExp);

	//实体装备加入场景（这游戏设定的奖励道具是掉落场景中）-------------------------------------让装备物品掉落场景中
	for (i = 0, l=equipments.length; i < l; i ++) {
		area.addEntity(equipments[i]);
	}

	//推送消息给该玩家
	messageService.pushMessageToPlayer({uid:player.userId, sid : player.serverId}, 'onDropItems', equipments);
};

/**
 * Rewards of equipments.
 *
 * @param {Array} items
 * @param {Object} pos
 * @return {Object}
 * @api private
 */
//奖励装备物品，返回equipment实体组
taskReward._rewardItem = function(items, pos) {
	var length = items.length;
	var equipments = [];
	if (length > 0) {
		for (var i = 0; i < length; i++) {
			var itemId = items[i];
			//通过id获取装备数据
			var itemData = dataApi.equipment.findById(itemId);
			//生成装备物品 实体
			var equipment = new Equipment({
				kindId: itemData.id,
				x: pos.x + Math.random() * 50,
				y: pos.y + Math.random() * 50,
				kindName: itemData.name,
				name: itemData.name,
				desc: itemData.desc,
				kind: itemData.kind,
				attackValue: itemData.attackValue,
				defenceValue: itemData.defenceValue,
				price: itemData.price,
				color: itemData.color,
				imgId: itemData.imgId,
				heroLevel: itemData.heroLevel,
				playerId: itemData.playerId
			});
			equipments.push(equipment);
		}
		return equipments;
	}
};

/**
 * Rewards of exprience.
 *
 * @param {Player} player
 * @param {Number} exprience
 * @api private
 */
//奖赏经验
taskReward._rewardExp = function(player, exprience) {
	player.addExperience(exprience);
};

