var Action = require('./action');
var util = require('util');
var messageService = require('../messageService');
var consts = require('../../consts/consts');
var logger = require('pomelo-logger').getLogger(__filename);

/**
 * Move action, which is used to preserve and update user position
 * 移动动作，用于保存和更新用户位置，并把移动位置传递给aoi服务
 */
var Move = function(opts){
	opts.type = 'move';
	opts.id = opts.entity.entityId;
	opts.singleton = true;  //移动动作是独立行为

	 //上面是修改opt参数，下面是让move继承action函数对象。结合util.inherits()继承action的原型链,
	Action.call(this, opts); 
	this.entity = opts.entity;
	this.area = this.entity.area;
	this.path = opts.path;
	this.speed = Number(opts.speed);
	this.time = Date.now();
	this.pos = this.path[0];
	this.index = 1;
	this.tickNumber = 0;
};

util.inherits(Move, Action);//让move继承action函数的原型链

/**
 * Update the move action, it will calculate and set the entity's new position, and update AOI module
 * 【重要】更新移动动作，它将计算并设置实体的新位置，并更新AOI模块
 */
Move.prototype.update = function(){
	this.tickNumber++;
	var time = Date.now()-this.time;    //单次刷新的时间间隔,单位毫秒
	var speed = this.speed;
	if(speed > 600) {
		logger.warn('move speed too fast : %j', speed);
	}

	var path = this.path;
	var index = this.index;
	var travelDistance = speed*time/1000;   //单次刷新能移动的距离
	var oldPos = {x : this.pos.x, y : this.pos.y};
	var pos = oldPos;         //旧坐标，没移动前的坐标
	var dest = path[index];   //新坐标，要移动到的坐标
	var distance = getDis(this.pos, dest);  //根据两个坐标计算的距离

	//使用循环语句，完成一次刷新的移动距离
	while(travelDistance > 0){
		if(distance <= travelDistance){   //如果单次刷新能够完成移动距离,去运算下一个点
			travelDistance = travelDistance - distance;
			pos = path[index];
			index++;

			//If the index exceed the last point, means the move is finished
			//如果索引超过了最后一点，则意味着该移动完成了
			if(index >= path.length){
				this.finished = true;
				this.entity.isMoving = false;
				break;
			}

			dest = path[index];   //上面的index++，所以这个是下一个坐标
			distance = getDis(pos, dest);  //下一次坐标要移动的距离
		}else{
			distance = distance - travelDistance; //点击新坐标后,单个tick内剩余未完成的距离
			pos = getPos(pos, dest, distance); //计算出单次刷新移动到的坐标
			travelDistance = 0;
		}
	}

	this.pos = pos;
	this.index = index;

	//update一次，实体移动后的坐标（给出了最后移动坐标，也要沿着路径坐标走）
	this.entity.x = Math.floor(pos.x);
	this.entity.y = Math.floor(pos.y);

	//Update the aoi module
        //更新aoi模块
	var watcher = {id : this.entity.entityId, type : this.entity.type};
  this.area.timer.updateObject(watcher, oldPos, pos);
  this.area.timer.updateWatcher(watcher, oldPos, pos, this.entity.range, this.entity.range);
	if(this.entity.type === consts.EntityType.PLAYER){
		this.entity.save();
		if (this.tickNumber % 10 === 0) {
			messageService.pushMessageToPlayer({uid:this.entity.userId, sid : this.entity.serverId}, 'onPathCheckout', {
				entityId: this.entity.entityId,
				position: {
					x: this.entity.x,
					y: this.entity.y
				}
			});

		}
	}

	this.time = Date.now();
};

function getDis(pos1, pos2) {
	//Math.sqrt()求平方根,而Math.pow(x,y)返回 x 的 y 次幂的值..这里是求直角三角形对角线长度
	return Math.sqrt(Math.pow((pos1.x-pos2.x), 2) + Math.pow((pos1.y-pos2.y), 2));
	
}

function getPos(start, end, dis) {
	var length = getDis(start, end);
	var pos = {};

	pos.x = end.x - (end.x-start.x) * (dis/length);
	pos.y = end.y - (end.y-start.y) * (dis/length);

	return pos;
}

module.exports = Move;
