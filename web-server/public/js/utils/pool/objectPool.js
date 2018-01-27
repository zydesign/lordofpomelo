__resources__["/objectPool.js"] = {meta: {mimetype: "application/javascript"}, data: function(exports, require, module, __filename, __dirname) {

	/**
	 * Initialize 'objectPool' with the given 'opts'
	 * ObjectPool maintains a number of objects with the same information
	 */
	//对象池
	var ObjectPool = function(opts) {
		this.getNewObject = opts.getNewObject;          //从参数中获取对象（动画实例）
		this.destoryObject = opts.destoryObject;        //部分破坏
		this.initCount = opts.initCount || 5;           //初始化数量
		this.enlargeCount = opts.enlargeCount || 2;     //扩展数量（初始实例的对象被用完才使用）
		this.index = 0;                                 //标签（记录未调用长度）
		this.maxCount = 15;                             //最大数量
		this.pool = [];                                 //对象数组

		this._initialize();                             //立即执行初始化
	};

	/**
	 * Get item from objectPool.
	 *
	 * @return {Object}
	 * @api public
	 */

	//获取对象。当初始对象用完，会循环添加扩展对象，并调用
	ObjectPool.prototype.getObject = function() {
		//如果index > 0，返回pool中末位对象
		if (this.index > 0) {
			return this.pool[--this.index];
		}
		
		//如果pool中的对象数量超出最大中，返回null
		if (this.pool.length > this.maxCount) {
			return null;
		}
		
		//根据扩展数量，往pool数组开头添加对象
		for(var i = 0; i < this.enlargeCount; i++) {
			this.pool.unshift(this.getNewObject());
		}
		this.index = this.enlargeCount;
		return this.getObject();   //初始化的对象已用完，重新执行函数，获取扩展的对象
	};

	/**
	 * Return item to objectPool.
	 *
	 * @api public
	 */

	//回收对象。将回收对象替换到未调用对象后一位对象
	ObjectPool.prototype.returnObject = function(object) {

		//当标签记录长度是对象池长度时，说明对象池的所有对象回到未调用状态
		if (this.index >= this.pool.length) {
			return;
		}
		
		//如果标签长度小于pool长度，被调用的对象替换成回收对象，index +1
		this.pool[this.index++] = object;
	};

	/**
	 * Destory objectPool
	 *
	 * @api public
	 */

	//销毁对象池所有对象
	ObjectPool.prototype.destory = function() {
		var n = this.pool.length;
		for (var i = 0; i < n; i++) {
			this.destoryObject(this.pool[i]);
		}
		this.pool = null;
		this.getNewObject = null;
		this.destoryObject = null;
	};

	/*
	 * Initialize the object pool with function getNewObject
	 *
	 * @api private
	 */

	//初始化。就是实例N个动画对象存入pool中
	ObjectPool.prototype._initialize = function() {
		if (!this.getNewObject) {
			return;
		}
		for (var i = 0; i < this.initCount; i++) {
			this.pool[i] = this.getNewObject();
		}
		this.index = this.initCount;
	};

	module.exports = ObjectPool;

}};
