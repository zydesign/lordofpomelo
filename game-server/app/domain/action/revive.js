var Action = require('./action');
var messageService = require('../messageService');
var util = require('util');


//复活（怪物死亡复活）
var Revive = function(opts){
	opts.type = 'revive';
	opts.id = opts.entity.entityId;   //用实体id作为revive的id
	opts.singleton = true;   //只是给参数添加独立行为，不是revive的属性

	 //上面是修改opt参数，下面是让revive继承action函数对象。结合util.inherits()继承action的原型链,
	Action.call(this, opts);
	this.entity = opts.entity;
	this.area = this.entity.area;
	this.map = opts.map;
	this.time = opts.reviveTime;  //复活最小时间间隔
	this.now = Date.now();   //上一次复活时间
};

util.inherits(Revive, Action);

/**
 * Update revive time
 * @api public
 */
Revive.prototype.update = function(){
	var time = Date.now();   //当前刷新时间

	this.time -= time - this.now;  //复活最小时间间隔与当前复活时间差，如果小于零，则可以复活
	
	//条件设置为小于等于10才可以复活，更新对象坐标，更新观察者，并aoi广播消息给附近的观察者，对象复活位置及状态
	if(this.time <= 10){
		this.entity.died = false;
		this.entity.hp = this.entity.maxHp/2;

		var bornPlace = this.map.getBornPlace();

		var oldPos = {x : this.entity.x, y : this.entity.y};

		var newPos = {
			x : bornPlace.x + Math.floor(Math.random() * bornPlace.width),
			y : bornPlace.y + Math.floor(Math.random() * bornPlace.height)
		};

		var watcher = {id : this.entity.entityId, type : this.entity.type};
		this.area.timer.updateObject(watcher, oldPos, newPos);
		this.area.timer.updateWatcher(watcher, oldPos, newPos, this.entity.range, this.entity.range);

		this.entity.x = newPos.x;
		this.entity.y = newPos.y;

		messageService.pushMessageByAOI(
			this.area,
			{
				route: 'onRevive',
				entityId : this.entity.entityId,
				x: this.entity.x,
				y: this.entity.y,
				hp: this.entity.hp
			},
			{x : this.entity.x, y : this.entity.y});
		this.finished = true;
		this.entity.updateTeamMemberInfo();
	}
	
	//储存当前刷新时间。？？？应该是是复活后才储存吧
	this.now = time;
};

module.exports = Revive;
