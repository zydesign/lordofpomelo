var Action = require('./action');
var util = require('util');
var messageService = require('../messageService');
var consts = require('../../consts/consts');
var logger = require('pomelo-logger').getLogger(__filename);

/**
 * Move action, which is used to preserve and update user position
 * 移动动作，【主要作用通过update，不断刷新角色的自身坐标{x,y}，其他函数可以获取实体移动的实时坐标了】, 保存和更新用户位置，并把移动位置传递给aoi服务
 */

//移动动作。（characterEvent监听on移动事件调用，生成move实例提供的参数为{entity: character,path: paths.path,speed: speed}）
var Move = function(opts){
	opts.type = 'move';
	opts.id = opts.entity.entityId;  //用实体id作为move的id
	opts.singleton = true;  //只是给参数添加singleton，并不是move属性..............................

	 //上面是修改opt参数，下面是让move继承action函数对象。结合util.inherits()继承action的原型链,
	Action.call(this, opts); 
	this.entity = opts.entity;
	this.area = this.entity.area;
	this.path = opts.path;             //寻路路径，作为移动动作属性
	this.speed = Number(opts.speed);
	this.time = Date.now();   //上一次刷新时间
	this.pos = this.path[0];   //寻路路径第一个坐标，原点。【update后会更新为移动后的坐标】
	this.index = 1;            //移动到的坐标从path[1]开始的，因为path[0]是实体自身坐标。【update后会标记为下一个要移动的标签】
	this.tickNumber = 0;  //刷新次数
};

util.inherits(Move, Action);//让move继承action函数的原型链

/**
 * Update the move action, it will calculate and set the entity's new position, and update AOI module
 * 【重要】更新移动动作，它将计算并设置实体的新位置，并更新观察者信息，并aoi广播消息
 */
Move.prototype.update = function(){
	this.tickNumber++;
	var time = Date.now()-this.time;    //单次刷新的时间间隔,单位毫秒
	var speed = this.speed;
	//速度超出范围，发出警告
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
		if(distance <= travelDistance){   //如果一个寻路坐标的距离小于刷新距离，计算剩下的刷新距离
			travelDistance = travelDistance - distance;
			pos = path[index];     //移动到的坐标................................pos
			index++;

			//If the index exceed the last point, means the move is finished
			//如果索引了寻路最后一个坐标，则意味着该移动完成了，退出循环
			if(index >= path.length){
			//寻路路径完成，move动作添加finnished属性，ActionManager.update检测动作组中的Finnished属性，true就删除该动作-----0
				this.finished = true;  
				this.entity.isMoving = false;
				break;
			}

			dest = path[index];   //上面的index++，所以这个是下一个坐标
			distance = getDis(pos, dest);  //下一次坐标要移动的距离
		}else{
			//如果寻路坐标距离超出刷新距离了，计算该段的剩余的寻路坐标距离
			distance = distance - travelDistance; //点击新坐标后,单个tick内剩余未完成的距离
			pos = getPos(pos, dest, distance); //刷新距离用光后所能移动到的坐标...........................pos
			travelDistance = 0;              //刷新距离归零
		}
	}

	//更新一次update移动到的坐标，下次从这里开始
	this.pos = pos;
	//记录一次update使用的寻路坐标组的key
	this.index = index;

	//update一次，更新实体坐标为移动后的坐标 -------------------------------------------------------------更新实体坐标 
	//调用实时坐标：1.loop.update巡逻动作，生成move动作后，实时获取实体坐标，判断是否到达巡逻坐标；
	//            2.ai动作moveToTarget生成move动作后，实时获取实体坐标，判断是否进入攻击距离，拾取距离，对话距离；
	this.entity.x = Math.floor(pos.x);
	this.entity.y = Math.floor(pos.y);

	//Update the aoi module
        //更新aoi模块
	var watcher = {id : this.entity.entityId, type : this.entity.type};
	//更新实体的在场景中从旧坐标oldPos移动到新坐标pos
  this.area.timer.updateObject(watcher, oldPos, pos);
	//更新观察者
  this.area.timer.updateWatcher(watcher, oldPos, pos, this.entity.range, this.entity.range);
	//如果移动的角色为【玩家】，则发射save事件，同步到数据库----------------------------------------------------
	if(this.entity.type === consts.EntityType.PLAYER){
		this.entity.save();
		//每刷新10次广播一次消息给玩家自己.........................
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
