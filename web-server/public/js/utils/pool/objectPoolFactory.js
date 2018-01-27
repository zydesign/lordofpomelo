__resources__["/objectPoolFactory.js"] = {meta: {mimetype: "application/javascript"}, data: function(exports, require, module, __filename, __dirname) {

	/**
	 * Module dependencies
	 *
	 */
	var ObjectPool = require('objectPool');           //对象池类
	var Animation = require('animation');             //动画类
	var getPoolName = require('utils').getPoolName;   //获取对象池名
	var app = require('app');                         //app脚本

	/**
	 * The factory of creating objectPool.
	 */
	//对象池工厂（resourceLoader的initObjectPools调用该函数）
	var ObjectPoolFactory = function() {
		this.name = ['LeftUpStand', 'RightUpStand', 'LeftUpWalk', 'RightUpWalk', 'LeftUpAttack', 'RightUpAttack', 'LeftUpDead', 'RightUpDead',
			           'LeftDownStand', 'RightDownStand', 'LeftDownWalk', 'RightDownWalk', 'LeftDownAttack', 'RightDownAttack', 'LeftDownDead', 
								 'RightDownDead'];
	};

	module.exports = ObjectPoolFactory;

	/**
	 * Create pools for each kindId and add the created pool to objectPoolManager.pools 
	 *
	 * @param {Number} kindId
	 * @param {String} type
	 * @api public
	 */
	//创建对象池（一份kindId数据有16份帧动画数据，可以创建16个对象池）
	ObjectPoolFactory.prototype.createPools = function(kindId, type) {
		var name = this.name;

		//遍历每个动画名
		for (var i = 0; i < name.length; i++) {
				var animationName = name[i];
				var objectPool = createPool(kindId, type, animationName);  //一个对象名创建一个对象池
				var poolName = getPoolName(kindId, animationName);         //生成对象池名（kindId+name）
				app.getObjectPoolManager().addPool(poolName, objectPool);  //对象池加入管理器的对象池组中
		}
	};
		
	/**
	 * Create object pool.
	 *
	 * @return {ObjectPool}
	 * @api private
	 */
	//创建对象池（参数：种类id、类型、动画名、flipx）,返回结果是ObjectPool实例
	var createPool = function(kindId, type, name, flipx) {
		//获取动画对象，为帧动画实例
		var getAniamtion = function() {
			return new Animation({
				kindId: kindId,
				type: type,
				name: name,
				flipx: flipx
			}).create(); 
		};
		return new ObjectPool({              //通过帧动画对象生成对象池
			getNewObject: getAniamtion
		});	
	};
}};
