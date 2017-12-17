var EntityType = require('../../consts/consts').EntityType;
var pomelo = require('pomelo');
var npcEvent = require('./npcEvent');
var characterEvent = require('./characterEvent');
var playerEvent = require('./playerEvent');

var exp = module.exports;

/**
 * Listen event for entity
 */
//area场景添加实体时，添加事件。（何时添加实体？area初始化NPCs时，timer更新怪物空间时，怪物掉落道具时，玩家进入场景时）
exp.addEvent = function(entity){
	switch(entity.type){
		case EntityType.PLAYER :
			playerEvent.addEventForPlayer(entity);
			characterEvent.addEventForCharacter(entity);
			addSaveEvent(entity);
			break;
		case EntityType.MOB :
			characterEvent.addEventForCharacter(entity);
			break;
		case EntityType.NPC :
			npcEvent.addEventForNPC(entity);
			break;
	}
};

/**
 * Add save event for player
 * @param {Object} player The player to add save event for.
 */
//实体类型为玩家时，存数据事件。角色、背包、装备三个实体监听了'save'事件.有各自的save（）函数包裹着发射事件。
//其中背包、装备继承基类Persistent而调用save()函数。

//持久化同步的作用：激活储存事件，会先储存数据到内存队列中，同步模块sync会间隔一定时间将内存数据保存到数据库
function addSaveEvent(player) {
	var app = pomelo.app;
	player.on('save', function() {
		app.get('sync').exec('playerSync.updatePlayer', player.id, player.strip());
	});

	player.bag.on('save', function() {
		app.get('sync').exec('bagSync.updateBag', player.bag.id, player.bag);
	});

	player.equipments.on('save', function() {
		app.get('sync').exec('equipmentsSync.updateEquipments', player.equipments.id, player.equipments);
	});
}

