var Blackboard = require('../meta/blackboard');

var exp = module.exports;

//该模块作用：1.添加角色大脑   2.删除角色大脑   3.刷新大脑信息（执行所有大脑的udate，顺序执行攻击、拾取、npc对话）

//ai管理器属性有：大脑服务、场景、玩家、怪物
var Manager = function(opts) {
	this.brainService = opts.brainService;
	this.area = opts.area;
	this.players = {};
	this.mobs = {};
};

module.exports = Manager;

var pro = Manager.prototype;

pro.start = function() {
	this.started = true;
};

pro.stop = function() {
	this.closed = true;
};

/**
 * Add a character into ai manager.
 * Add a brain to the character if the type is mob.
 * Start the tick if it has not started yet.
 */

//通过角色参数，创建大脑实例，并储存到玩家大脑组和怪物大脑中

        //参数cs为角色数组
pro.addCharacters = function(cs) {
	//如果还没开启ai管理器或已经结束ai管理器，则不增加角色大脑
	if(!this.started || this.closed) {
		return;
	}

	//如果参数角色不存在则返回
	if(!cs || !cs.length) {
		return;
	}

	//create brain for the character.
	//TODO: add a brain pool?
	var c;
	for(var i=0, l=cs.length; i<l; i++) {
		c = cs[i];
		var brain;
		 
		if(c.type === 'player') {
			//如果角色组已经有了该角色，遍历下一个
			if(this.players[c.entityId]) {
				//continue是结束本次循环，也即是进行下一个遍历
				continue;
			}

			//实例一个带参数的大脑，然后添加到角色组
			brain = this.brainService.getBrain('player', Blackboard.create({
				manager: this,
				area: this.area,
				curCharacter: c
			}));
			this.players[c.entityId] = brain;
		} else {
			//如果怪物组已经有了该怪物角色，遍历下一个
			if(this.mobs[c.entityId]) {
				continue;
			}

			//实例一个带参数的大脑，然后添加到怪物组
			//无论c.characterName取什么名字，大脑服务都将非玩家归结为tiger
			brain = this.brainService.getBrain(c.characterName, Blackboard.create({
				manager: this,
				area: this.area,
				curCharacter: c
			}));
			this.mobs[c.entityId] = brain;
		}
	}
};

/**
 * remove a character by id from ai manager
 */

//从大脑组中移除某个大脑实例
pro.removeCharacter = function(id) {
	if(!this.started || this.closed) {
		return;
	}

	delete this.players[id];
	delete this.mobs[id];
};

/**
 * Update all the managed characters.
 * Stop the tick if there is no ai mobs.
 */

//遍历大脑组，执行所有大脑实例的update
pro.update = function() {
	if(!this.started || this.closed) {
		return;
	}
	var id;
	for(id in this.players) {
		if(typeof this.players[id].update === 'function') {
			this.players[id].update();
		}
	}
	for(id in this.mobs) {
		if(typeof this.mobs[id].update === 'function') {
			this.mobs[id].update();
		}
	}
};

