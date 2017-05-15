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

	this.limit = opts.mobNum||defaultLimit;  //怪物数量限制
	this.count = 0;  //当前怪物数量
	this.mobs = {};  //怪物对象集合

	this.lastGenTime = 0;   //上一次生成怪物时间
	this.genCount = 3;      //一次update最多可以生成3个怪物
	this.interval = 5000;   //生成时间间隔
};

util.inherits(MobZone, Zone);

/**
 * Every tick the update will be called to generate new mobs
 * 每一次更新都会被调用来生成新的mobs
 * 每隔5秒生成一个怪物，如果怪物达到限定数则不再生成
 */
MobZone.prototype.update = function() {
	var time = Date.now();   //当前时间
	var nextTime = this.lastGenTime + this.interval;  //下一次生成怪物时间

	for(var i = 0; i < this.genCount; i++) {
		if(this.count < this.limit && nextTime <= time) {
			this.generateMobs();  //生成一个怪物
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
        //do...while循环，如果生成的怪物数据坐标map地图内无效（不在地图内或在障碍物上），
	//就从新生成，限制20次内，得到的是一个坐标
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
	mob.spawnX = mob.x;   //其实也是mobData.x
	mob.spawnY = mob.y;   //其实也是mobData.y
	genPatrolPath(mob);  //生成怪物巡逻路径
	//将怪物加入到怪物空间
	this.add(mob);
        
	//将怪物加入场景
	this.area.addEntity(mob);
	this.count++;  //生成一个怪物后，怪物空间的怪物数量加1
};

/**
 * Add a mob to the mobzones
 * 增加怪物到怪物空间
 */
MobZone.prototype.add = function(mob) {
	this.mobs[mob.entityId] = mob;
};

/**
 * Remove a mob from the mob zone
 * 从怪物空间中删除怪物
 * @param {Number} id The entity id of the mob to remove.
 */
MobZone.prototype.remove = function(id) {
	if(!!this.mobs[id]) {
		delete this.mobs[id];
		this.count--;
	}
	return true;
};

var PATH_LENGTH = 3;   //路径长度，坐标数量
var MAX_PATH_COST = 300;  //

/**
 * Generate patrol path for mob
 * 生成怪物巡逻路径，返回坐标数组（4个坐标）
 */
var genPatrolPath = function(mob) {
	var map = mob.area.map;
	var path = []; //创建一个路径坐标数组
	var x = mob.x, y = mob.y, p;
	for(var i=0; i<PATH_LENGTH; i++) {
		p = genPoint(map, x, y);  //通过地图和怪物坐标，生成3个路径的坐标
		if(!p) {
			// logger.warn("Find path for mob faild! mobId : %j", mob.entityId);
			break;
		}
		path.push(p);
		x = p.x;
		y = p.y;
	}
	path.push({x: mob.x, y: mob.y}); //路径3个坐标，再加入怪物本身的坐标，共4个坐标
	mob.path = path;
};

/**
 * Generate point for given point, the radius is form 100 to 200.
 * 在怪物坐标为圆心，半径为100~200内，并保证在地图范围内，随机生成坐标点
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
        //检测生成的坐标是否合法，如果不合法则从新生成，机会10次
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
 * 检查路径是否有效，有两个极限，1，路径有效吗?2、费用超过最大成本吗?
 * @param ox, oy {Number} Start point
 * @param dx, dy {Number} End point
 */
var checkPoint = function(map, ox, oy, dx, dy) {
	//检测坐标是否合法
	if(!map.isReachable(dx, dy)) {
		return false;
	}
        //生成寻路路径
	var res = map.findPath(ox, oy, dx, dy);
	//检测生成的路径是否合法
	if(!res || !res.path || res.cost > MAX_PATH_COST) {
		return false;
	}

	return true;
};

module.exports = MobZone;
