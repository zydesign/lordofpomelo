
//大脑服务只有大脑组、添加大脑、获取大脑
var Service = function() {
	this.brains = {};
};

module.exports = Service;

var pro = Service.prototype;

//大脑服务可以获取大脑和注册大脑
pro.getBrain = function(type, blackboard) {
	//TODO: mock data
	// 如果类型既不是autoFight，也不是player，才会执行type = 'tiger'
	if(type !== 'autoFight' && type !== 'player') {
		//这里大脑服务将所有怪物类型都归结为tiger类型
		type = 'tiger';
	}
	var brain = this.brains[type];
	//如果大脑组里面存在要找的大脑，就会返回一个该类型大脑实例，如果没有返回null
	if(brain) {
		return brain.clone({blackboard: blackboard});
	}
	return null;
};

 //注册大脑就是把大脑存入大脑组中
pro.registerBrain = function(type, brain) {
	this.brains[type] = brain;
};

