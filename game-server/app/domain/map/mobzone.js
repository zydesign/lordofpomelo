var util = require('util');
var Zone = require('./zone');
var Mob = require('./../entity/mob');
var utils = require('../../util/utils');
var dataApi = require('../../util/dataApi');
var logger = require('pomelo-logger').getLogger(__filename);

var defaultLimit = 10;

/**
 * The mob zone for generate mobs
 */
var MobZone = function(opts) {
	Zone.call(this, opts);
	this.area = opts.area;
	this.map = opts.area.map;
	this.mobId = opts.mobId;
	//通过指定的怪物id复制一份这个怪物的数据对象（单份数据的属性名为英文项目名）
	this.mobData = utils.clone(dataApi.character.findById(this.mobId));
	
        //给这个怪物数据，添加数据和修改部分数据值
	this.mobData.zoneId = this.zoneId;
	this.mobData.areaId = this.area.id;
	this.mobData.area = this.area;
	this.mobData.kindId = this.mobData.id;
	this.mobData.kindName = this.mobData.name;
	this.mobData.level = opts.level || 1;
	this.mobData.weaponLevel = opts.weaponLevel || 1;
	this.mobData.armorLevel = opts.armorLevel || 1;

	this.limit = opts.mobNum||defaultLimit;
	this.count = 0;
	this.mobs = {};

	this.lastGenTime = 0;
	this.genCount = 3;
	this.interval = 5000;
};

util.inherits(MobZone, Zone);

/**
 * Every tick the update will be called to generate new mobs
 * 每一次更新都会被调用来生成新的mobs
 * 每隔5秒生成一个怪物，如果怪物达到限定数则不再生成
 */
MobZone.prototype.update = function() {
	var time = Date.now();
	var nextTime = this.lastGenTime + this.interval;

	for(var i = 0; i < this.genCount; i++) {
		if(this.count < this.limit && nextTime <= time) {
			this.generateMobs();
			this.lastGenTime = time;
		}
	}

	if(this.count === this.limit) {
		this.lastGenTime = time;
	}
};

/**
 * The nenerate mob funtion, will generate mob, update aoi and push the message to all interest clients
 * 生成怪物，更新aoi并且推送消息给观察者
 */
MobZone.prototype.generateMobs = function() {
	//生成一份怪物数据
	var mobData = this.mobData;
	if(!mobData) {
		logger.error('load mobData failed! mobId : ' + this.mobId);
		return;
	}

	var count = 0, limit = 20;
	do{
		//在怪物空间范围内随机生成怪物坐标
		mobData.x = Math.floor(Math.random()*this.width) + this.x;
		mobData.y = Math.floor(Math.random()*this.height) + this.y;
	} while(!this.map.isReachable(mobData.x, mobData.y) && count++ < limit);

	if(count > limit){
		logger.error('generate mob failed! mob data : %j, area : %j, retry %j times', mobData, this.area.id, count);
		return;
	}
            
	//生成怪物  怪物坐标  怪物巡逻路径
	var mob = new Mob(mobData);
	mob.spawnX = mob.x;
	mob.spawnY = mob.y;
	genPatrolPath(mob);
	//将怪物加入到怪物空间
	this.add(mob);
        
	//将怪物加入场景
	this.area.addEntity(mob);
	this.count++;
};

/**
 * Add a mob to the mobzones
 */
MobZone.prototype.add = function(mob) {
	this.mobs[mob.entityId] = mob;
};

/**
 * Remove a mob from the mob zone
 * @param {Number} id The entity id of the mob to remove.
 */
MobZone.prototype.remove = function(id) {
	if(!!this.mobs[id]) {
		delete this.mobs[id];
		this.count--;
	}
	return true;
};

var PATH_LENGTH = 3;
var MAX_PATH_COST = 300;

/**
 * Generate patrol path for mob
 */
var genPatrolPath = function(mob) {
	var map = mob.area.map;
	var path = [];
	var x = mob.x, y = mob.y, p;
	for(var i=0; i<PATH_LENGTH; i++) {
		p = genPoint(map, x, y);
		if(!p) {
			// logger.warn("Find path for mob faild! mobId : %j", mob.entityId);
			break;
		}
		path.push(p);
		x = p.x;
		y = p.y;
	}
	path.push({x: mob.x, y: mob.y});
	mob.path = path;
};

/**
 * Generate point for given point, the radius is form 100 to 200.
 * @param originX, originY {Number} The oright point
 * @param count {Number} The retry count before give up
 * @api private
 */
var genPoint = function(map, originX, originY, count) {
	count = count || 0;
	var disx = Math.floor(Math.random() * 100) + 100;
	var disy = Math.floor(Math.random() * 100) + 100;
	var x, y;
	if(Math.random() > 0.5) {
		x = originX - disx;
	} else {
		x = originX + disx;
	}
	if(Math.random() > 0.5) {
		y = originY - disy;
	} else {
		y = originY + disy;
	}

	if(x < 0) {
		x = originX + disx;
	} else if(x > map.width) {
		x = originX - disx;
	}
	if(y < 0) {
		y = originY + disy;
	} else if(y > map.height) {
		y = originY - disy;
	}

	if(checkPoint(map, originX, originY, x, y)) {
		return {x: x, y: y};
	} else {
		if(count > 10) {
			return;
		}
		return genPoint(map, originX, originY, count + 1);
	}
};

/**
 * Check if the path is valid, there are two limit, 1, Is the path valid? 2, Is the cost exceed the max cost?
 * @param ox, oy {Number} Start point
 * @param dx, dy {Number} End point
 */
var checkPoint = function(map, ox, oy, dx, dy) {
	if(!map.isReachable(dx, dy)) {
		return false;
	}

	var res = map.findPath(ox, oy, dx, dy);
	if(!res || !res.path || res.cost > MAX_PATH_COST) {
		return false;
	}

	return true;
};

module.exports = MobZone;
