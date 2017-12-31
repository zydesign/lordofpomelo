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
//怪物空间类。在指定场景某区域内生成怪物
var MobZone = function(opts) {
	Zone.call(this, opts);
	this.area = opts.area;
	this.map = opts.area.map;
	this.mobId = opts.mobId;
	//通过指定的怪物id复制一份这个怪物的数据对象（单份数据的属性名为英文项目名）
	this.mobData = utils.clone(dataApi.character.findById(this.mobId));
	
        //给这个怪物数据，添加属性
	this.mobData.zoneId = this.zoneId;                           //怪物空间所在的空间id
	this.mobData.areaId = this.area.id;                          //所在的场景id
	this.mobData.area = this.area;                               //所在的场景
	this.mobData.kindId = this.mobData.id;                       //怪物类型id，即character怪物表的id
	this.mobData.kindName = this.mobData.name;                   //怪物名字
	this.mobData.level = opts.level || 1;                        //怪物等级
	this.mobData.weaponLevel = opts.weaponLevel || 1;            //怪物武器等级
	this.mobData.armorLevel = opts.armorLevel || 1;              //怪物防御等级

	this.limit = opts.mobNum||defaultLimit;                      //怪物数量限制
	this.count = 0;                                              //当前怪物数量
	this.mobs = {};                                              //怪物组

	this.lastGenTime = 0;   //上一次生成怪物时间
	this.genCount = 3;      //一次update最多可以生成3个怪物
	this.interval = 5000;   //生成怪物时间间隔
};

util.inherits(MobZone, Zone);

/**
 * Every tick the update will be called to generate new mobs
 * 每一次更新都会被调用来生成新的mobs
 * 每隔5秒生成1~3个怪物，一般只能生成一个，如果怪物达到限定数则不再生成
 */

//间隔5秒，在限制数量内在场景area中生成一个怪物实体。场景开启后，这个函数会被Timer定时器定时执行
MobZone.prototype.update = function() {
	var time = Date.now();   //当前时间
	var nextTime = this.lastGenTime + this.interval;  //生成怪物的时间

	//生成怪物1~3个怪物
	for(var i = 0; i < this.genCount; i++) {
		//如果怪物空间怪物数量小于限制数量，而且到了怪物生成时间
		if(this.count < this.limit && nextTime <= time) {
			//生成一个怪物，这个怪物会被加入MobZone的怪物对象集，并生成怪物巡逻的坐标
			this.generateMobs();  
			this.lastGenTime = time;    //更新上一次怪物生成时间
		}
	}

	//如果数量达到限制，即使没有生成怪物，也要更新上一次怪物生成时间为当前时间
	if(this.count === this.limit) {
		this.lastGenTime = time;
	}
};

/**
 * The nenerate mob funtion, will generate mob, update aoi and push the message to all interest clients
 * 生成怪物，更新aoi并且推送消息给观察者
 */
MobZone.prototype.generateMobs = function() {	 
	var mobData = this.mobData;
	if(!mobData) {
		logger.error('load mobData failed! mobId : ' + this.mobId);
		return;
	}
	//先生成怪物坐标.......................................
        //do...while循环，如果生成的怪物数据坐标map地图内无效（不在地图内或在障碍物上），就从新生成坐标，限制20次内 	
	var count = 0, limit = 20;
	do{
		//生成怪物数据坐标。空间的坐标是空间方块的左下角，这里生成的坐标在方块里面
		mobData.x = Math.floor(Math.random()*this.width) + this.x;  //this.x是基类zone的坐标（左下角）
		mobData.y = Math.floor(Math.random()*this.height) + this.y;
	} while(!this.map.isReachable(mobData.x, mobData.y) && count++ < limit);

	//如果随机了20次都遇到障碍物，直接返回
	if(count > limit){
		logger.error('generate mob failed! mob data : %j, area : %j, retry %j times', mobData, this.area.id, count);
		return;
	}
            
	//生成怪物实例
	var mob = new Mob(mobData);
	mob.spawnX = mob.x;   //给怪物添加卵坐标(怪物坐标)属性
	mob.spawnY = mob.y; 
	
	//执行生成怪物巡逻路径，执行结果是给mob实体添加path属性（包括自身坐标在内的4个坐标）..................
	genPatrolPath(mob);
	
	//执行将怪物实体加入MobZone的怪物组
	this.add(mob);
        
	//将怪物加入场景（该怪物带有path巡逻路径了）........................................
	//加入场景就会加入ai系统，ai判定实体为怪物就会给怪物装上tiger大脑，该大脑updata移到玩家就攻击否则巡逻，巡逻会使用path属性
	this.area.addEntity(mob);
	this.count++;  //生成一个怪物后，怪物空间的怪物数量加1
};

/**
 * Add a mob to the mobzones
 * 增加怪物实体到怪物空间
 */
MobZone.prototype.add = function(mob) {
	this.mobs[mob.entityId] = mob;
};

/**
 * Remove a mob from the mob zone
 * 从怪物空间中删除怪物
 * @param {Number} id The entity id of the mob to remove.
 */
//怪物空间的怪物组中删除指定实体id的怪物实体，返回true
//（场景删除实体时，area.removeEntity会执行该函数）..............................
MobZone.prototype.remove = function(id) {
	if(!!this.mobs[id]) {
		delete this.mobs[id];
		this.count--;
	}
	return true;
};

var PATH_LENGTH = 3;   //路径坐标数量
var MAX_PATH_COST = 300;  //路径坐标最大数量

/**
 * Generate patrol path for mob
 * 生成3个怪物巡逻坐标，并加上怪物本身坐标，返回坐标数组（4个坐标）
 */
var genPatrolPath = function(mob) {
	var map = mob.area.map;  //地图类实例
	var path = []; //创建一个巡逻路径 
	var x = mob.x, y = mob.y, p;
	for(var i=0; i<PATH_LENGTH; i++) {
		p = genPoint(map, x, y);  //通过地图和怪物坐标，生成3个路径的坐标
		if(!p) {
			// logger.warn("Find path for mob faild! mobId : %j", mob.entityId);
			break;
		}
		path.push(p);
		//以生成的坐标为基础，再生成下一个坐标
		x = p.x;
		y = p.y;
	}
	path.push({x: mob.x, y: mob.y}); //生成了3个巡逻坐标，再加入怪物本身的坐标，共4个坐标
	mob.path = path;   //将巡逻路径添加到怪物实体中
};

/**
 * Generate point for given point, the radius is form 100 to 200.
 * 在怪物坐标为圆心，半径为100~200内，并保证在地图范围内，随机生成坐标点
 * @param originX, originY {Number} The oright point
 * @param count {Number} The retry count before give up
 * @api private
 */
//通过怪物当前坐标生成新的巡逻坐标。(originX, originY,是怪物坐标)
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

	//保证新坐标在地图内
	//如果生成的坐标小于0，取坐标+距离；如果生成坐标超出x，y最大值（地图宽高），取坐标-距离
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
	//参数解析：originX, originY是怪物坐标；x, y是生成怪物巡逻的新坐标
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
