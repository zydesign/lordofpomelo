var messageService = require('../messageService');
var EntityType = require('../../consts/consts').EntityType;
var logger = require('pomelo-logger').getLogger(__filename);
var utils = require('../../util/utils');

var exp = module.exports;

//Add event for aoi
//为aoi添加事件监听,监听对象的add、remove、update，观察者的updateWatcher。
//aoi就是对象ids和观察者ids的管理，对象ids会在updateWatcher被调用
//当触发事件时，获取观察者uids，并广播消息。观察者时怪物的话，就激化这些怪物仇恨
exp.addEvent = function(area, aoi){
	aoi.on('add', function(params){   //加入事件
		params.area = area;
		switch(params.type){
			case EntityType.PLAYER:
	//广播消息给玩家观察者们，并给MOB观察者们添加仇恨，对该玩家id
				onPlayerAdd(params);
				break;
			case EntityType.MOB:
	//广播消息给玩家观察者们，并获取实体MOB所在灯塔的实体ids（类型为player），对ids都添加MOB仇恨
				onMobAdd(params);
				break;
		}
	});

	aoi.on('remove', function(params){  //离开事件
		params.area = area;
		switch(params.type){
			case EntityType.PLAYER:
	//广播消息给玩家观察者们
				onPlayerRemove(params);
				break;
			case EntityType.MOB:
				break;
		}
	});

	aoi.on('update', function(params){  //更新事件
		params.area = area;
		switch(params.type){
			case EntityType.PLAYER:
	//广播消息给玩家观察者们（移除的观察者removeWatchers和新加的观察者addWatchers）
				onObjectUpdate(params);
				break;
			case EntityType.MOB:
				onObjectUpdate(params);
				break;
		}
	});

	aoi.on('updateWatcher', function(params) {  //更新观察者事件
		params.area = area;
		switch(params.type) {
			case EntityType.PLAYER:
	//广播消息给玩家自己，观察的实体的变动
				onPlayerUpdate(params);
				break;
		}
	});
};

/**
 * Handle player add event  处理玩家加入事件,要告诉视野范围内的玩家和怪物,自己加入了
 * @param {Object} params Params for add player, the content is : {watchers, id}
 * @return void
 * @api private
 */
function onPlayerAdd(params) {
	var area = params.area;
	var watchers = params.watchers;
	var entityId = params.id;
	var player = area.getEntity(entityId);

	if(!player) {
		return;
	}

	var uids = [], id;
	for(var type in watchers) {
		switch (type){
			case EntityType.PLAYER:
				for(id in watchers[type]) {
					var watcher = area.getEntity(watchers[type][id]);
					if(watcher && watcher.entityId !== entityId) {
						uids.push({sid: watcher.serverId, uid: watcher.userId});
					}
				}
				if(uids.length > 0){
					onAddEntity(uids, player); //广播消息给视野内玩家,玩家加入
				}
				break;
			case EntityType.MOB:
				for(id in watchers[type]) {
					var mob = area.getEntity(watchers[type][id]);
					if(mob) {
						mob.onPlayerCome(entityId);
					}
				}
				break;
		}
	}
}

/**
 * Handle mob add event 处理怪物加入事件,告诉视野范围的玩家,有怪物进入视野
 * @param {Object} params Params for add mob, the content is : {watchers, id}
 * @return void
 * @api private
 */
function onMobAdd(params){
	var area = params.area;
	var watchers = params.watchers;
	var entityId = params.id;
	var mob = area.getEntity(entityId);

	if(!mob) {
		return;
	}

	var uids = [];
	for(var id in watchers[EntityType.PLAYER]) {
		var watcher = area.getEntity(watchers[EntityType.PLAYER][id]);
		if(watcher) {
			uids.push({sid: watcher.serverId, uid: watcher.userId});
		}
	}

	if(uids.length > 0) {
		onAddEntity(uids, mob);  //广播消息给玩家(玩家视野),怪物加入
	}
            //获取怪物视野内的玩家ids，并添加仇恨
	var ids = area.aoi.getIdsByRange({x:mob.x, y:mob.y}, mob.range, [EntityType.PLAYER])[EntityType.PLAYER];
	if(!!ids && ids.length > 0 && !mob.target){
		for(var key in ids){
			mob.onPlayerCome(ids[key]);
		}
	}
}

/**
 * Handle player remove event   处理玩家离开事件
 * @param {Object} params Params for remove player, the content is : {watchers, id}
 * @return void
 * @api private
 */
function onPlayerRemove(params) {
	var area = params.area;
	var watchers = params.watchers;
	var entityId = params.id;

	var uids = [];

	for(var type in watchers) {
		switch (type){
			case EntityType.PLAYER:
				var watcher;
				for(var id in watchers[type]) {
					watcher = area.getEntity(watchers[type][id]);
					if(watcher && entityId !== watcher.entityId) {
						uids.push({sid: watcher.serverId, uid: watcher.userId});
					}
				}

				onRemoveEntity(uids, entityId); //广播消息给观察者,玩家离开
				break;
		}
	}
}

/**
 * Handle object update event 
 * 处理对象更新事件.
 * 如果离开玩家视野告诉这部分玩家,玩家离开;如果进入新玩家视野,告诉这部分玩家,玩家加入
 * 进入新怪物视野或离开旧怪物视野,告诉这部分怪物进入与离开
 * @param {Object} params Params for add object, the content is : {oldWatchers, newWatchers, id}
 * @return void
 * @api private
 */
function onObjectUpdate(params) {
	var area = params.area;
	var entityId = params.id;
	var entity = area.getEntity(entityId);

	if(!entity) {
		return;
	}

	var oldWatchers = params.oldWatchers;
	var newWatchers = params.newWatchers;
	var removeWatchers = {}, addWatchers = {}, type, w1, w2, id;
	for(type in oldWatchers) {
		if(!newWatchers[type]) {
			removeWatchers[type] = oldWatchers[type];
			continue;
		}
		w1 = oldWatchers[type];
		w2 = newWatchers[type];
		removeWatchers[type] = {};
		for(id in w1) {
			if(!w2[id]) {
				removeWatchers[type][id] = w1[id];
			}
		}
	}

	for(type in newWatchers) {
		if(!oldWatchers[type]) {
			addWatchers[type] = newWatchers[type];
			continue;
		}

		w1 = oldWatchers[type];
		w2 = newWatchers[type];
		addWatchers[type] = {};
		for(id in w2) {
			if(!w1[id]) {
				addWatchers[type][id] = w2[id];
			}
		}
	}


	switch(params.type) {
		case EntityType.PLAYER:
			//如果实体为玩家，广播消息给周围玩家，更新周围玩家对自己角色的可见不可见视野
			onPlayerAdd({area:area, id:params.id, watchers:addWatchers});
			onPlayerRemove({area:area, id:params.id, watchers:removeWatchers});
			break;
		case EntityType.MOB:
			//如果实体为怪物，广播消息给周围玩家，更新周围玩家对该怪物的可见不可见视野
			onMobAdd({area:area, id:params.id, watchers:addWatchers});
			onMobRemove({area:area, id:params.id, watchers:removeWatchers});
			break;
	}
}

/**
 * Handle player update event  处理玩家更新事件
 * @param {Object} params Params for player update, the content is : {watchers, id}
 * @return void
 * @api private
 */
function onPlayerUpdate(params) {
	var area = params.area;
	var player = area.getEntity(params.id);
	if(player.type !== EntityType.PLAYER) {
		return;
	}

	var uid = {sid : player.serverId, uid : player.userId};

	if(params.removeObjs.length > 0) {
    messageService.pushMessageToPlayer(uid, 'onRemoveEntities', {'entities' : params.removeObjs});
	}

	if(params.addObjs.length > 0) {
		var entities = area.getEntities(params.addObjs);
		if(entities.length > 0) {
      messageService.pushMessageToPlayer(uid, 'onAddEntities', entities);
		}
	}
}

/**
 * Handle mob remove event  处理怪物的离开事件
 * @param {Object} params Params for remove mob, the content is : {watchers, id}
 * @return void
 * @api private
 */
function onMobRemove(params) {
	var area = params.area;
	var watchers = params.watchers;
	var entityId = params.id;
	var uids = [];

	for(var type in watchers) {
		switch (type){
			case EntityType.PLAYER:
				for(var id in watchers[type]) {
					var watcher = area.getEntity(watchers[type][id]);
					if(watcher) {
						uids.push({sid: watcher.serverId, uid : watcher.userId});
					}
				}
				onRemoveEntity(uids, entityId);
			break;
		}
	}
}

/**
 * Push message for add entities 推送消息给视野范围内的其他玩家,自己或怪物加入视野(uids为被推送的对象,entity为行为对象)
 * @param {Array} uids The users to notify
 * @param {Number} entityId The entityId to add
 * @api private
 */
function onAddEntity(uids, entity) {
	var entities = {};
	entities[entity.type] = [entity];

  messageService.pushMessageByUids(uids, 'onAddEntities', entities);

	if (entity.type === EntityType.PLAYER) {
		utils.myPrint('entities = ', JSON.stringify(entities));
		utils.myPrint('teamId = ', JSON.stringify(entities[entity.type][0].teamId));
		utils.myPrint('isCaptain = ', JSON.stringify(entities[entity.type][0].isCaptain));
	}
}

/**
 * Push message for remove entities
 * @param {Array} uids The users to notify
 * @param {Number} entityId The entityId to remove
 * @api private
 */
function onRemoveEntity(uids, entityId) {
	if(uids.length <= 0) {
		return;
	}

  messageService.pushMessageByUids(uids, 'onRemoveEntities',{entities : [entityId]}, uids);
}
