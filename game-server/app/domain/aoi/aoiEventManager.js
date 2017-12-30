var messageService = require('../messageService');
var EntityType = require('../../consts/consts').EntityType;
var logger = require('pomelo-logger').getLogger(__filename);
var utils = require('../../util/utils');

var exp = module.exports;

//Add event for aoi
//aoi事件添加。（当场景加载时，会立即执行该函数）............................................................0

//为aoi添加事件监听,监听对象的add、remove、update，观察者的updateWatcher。
//aoi是对灯塔的管理，灯塔点就是对象ids和观察者ids的管理，对象ids会在updateWatcher被调用
//当触发事件时，获取观察者uids，并广播消息。观察者时怪物的话，就激化这些怪物仇恨
exp.addEvent = function(area, aoi){
	//aoi对象是继承事件监听器的，并且aoi的函数里面带有很多发射事件----------------------------------------------1
	
	//add实体加入事件。aoi执行添加对象函数时，就会发射add事件。
	//参数params为{id: obj.id, type:obj.type, watchers:aoi.towers[p.x][p.y].watchers}
	aoi.on('add', function(params){   
		params.area = area;       //参数加入场景属性
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

	//remove实体删除事件。
	//参数params为{id: obj.id, type:obj.type, watchers:aoi.towers[p.x][p.y].watchers}
	aoi.on('remove', function(params){ 
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

	//update‘实体更新’事件。实体位置改变，通知对应的灯塔点观察者组，看见与看不见该实体----多看1---------------------------------
	//参数params为{id: obj.id, type:obj.type, oldWatchers:oldTower.watchers, newWatchers:newTower.watchers}
	aoi.on('update', function(params){   
		params.area = area;
		switch(params.type){
			case EntityType.PLAYER:
	//推送消息给玩家观察者们，旧观察者删除可视实体，新观察者添加可视实体
				//执行更新对象函数
				onObjectUpdate(params);
				break;
			case EntityType.MOB:
				onObjectUpdate(params);
				break;
		}
	});

	//updateWatcher更新观察者事件。（玩家自己移动，通知作为观察者的自己，即将看不见和即将看见的实体组）-------1看多-------------------
	//参数params为{id: watcher.id, type:watcher.type, addObjs: addObjs, removeObjs:removeObjs}
	aoi.on('updateWatcher', function(params) {  
		params.area = area;
		switch(params.type) {
			case EntityType.PLAYER:
	//推送消息给玩家自己，观察的实体的变动
				onPlayerUpdate(params);
				break;
		}
	});
};

/**
 * Handle player add event  
 * @param {Object} params Params for add player, the content is : {watchers, id}
 * @return void
 * @api private
 */

//处理玩家加入事件,要告诉视野范围内的玩家和怪物,玩家（自己）加入了
function onPlayerAdd(params) {
	var area = params.area;
	var watchers = params.watchers;
	var entityId = params.id;
	var player = area.getEntity(entityId);

	if(!player) {
		return;
	}

	var uids = [], id;
	//让所在灯塔点的不同类型观察者，做成不同反应。
	for(var type in watchers) {
		switch (type){
			case EntityType.PLAYER:
				//如果观察者类型是玩家，获取玩家用户id组，广播消息告知有玩家加入
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
				//如果观察者的类型是怪物，让所有怪物观察者，攻击玩家
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
 * Handle mob add event 
 * @param {Object} params Params for add mob, the content is : {watchers, id}
 * @return void
 * @api private
 */

//处理怪物加入事件,告诉视野范围的玩家,有怪物进入视野
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
 * Handle player remove event   
 * @param {Object} params Params for remove player, the content is : {watchers, id}
 * @return void
 * @api private
 */
//处理玩家离开事件
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
 * @param {Object} params Params for add object, the content is : {oldWatchers, newWatchers, id}
 * @return void
 * @api private
 */

//通过新旧观察者，创建删除组和添加组。广播消息给删除组，删除对移动对象的可见；让添加组添加对对象的可见
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
	//在旧观察者中筛选需要删除的观察者，存入观察者删除组，【实体移动后，删除组removeWatchers看不到该实体】
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

	//在新观察者中筛选需要添加的观察者，存入观察者添加组【实体移动后，添加组addWatchers将添加对该实体的可视化】
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
			//如果移动的实体类型为玩家，执行玩家加入，执行玩家离开（广播消息让添加组看到该玩家，让删除组看不到该玩家）
			onPlayerAdd({area:area, id:params.id, watchers:addWatchers});
			onPlayerRemove({area:area, id:params.id, watchers:removeWatchers});
			break;
		case EntityType.MOB:
			//如果移动的实体类型为怪物，执行怪物加入，执行怪物离开（广播消息让添加组看到该怪物，让删除组看不到该怪物）
			onMobAdd({area:area, id:params.id, watchers:addWatchers});
			onMobRemove({area:area, id:params.id, watchers:removeWatchers});
			break;
	}
}

/**
 * Handle player update event  
 * @param {Object} params Params for player update, the content is : {watchers, id}
 * @return void
 * @api private
 */
//处理
function onPlayerUpdate(params) {
	var area = params.area;
	var player = area.getEntity(params.id);
	if(player.type !== EntityType.PLAYER) {
		return;
	}

	var uid = {sid : player.serverId, uid : player.userId};

	//推送消息给自己，参数为即将看不到的实体id数组removeObjs：[id,id,id...]
	if(params.removeObjs.length > 0) {
    messageService.pushMessageToPlayer(uid, 'onRemoveEntities', {'entities' : params.removeObjs});
	}

	//推送消息给自己，参数为即将看见的【实体组】（添加是要获取坐标的，所以要实体）
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

//通知玩家组，有实体加入。
function onAddEntity(uids, entity) {
	var entities = {};
	entities[entity.type] = [entity];

	//推送消息到玩家组，参数为实体组entities
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
