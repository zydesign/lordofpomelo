//优先队列
var PriorityQueue = require('pomelo-collection').priorityQueue;
var id = 0;

/**
 * The cache for pathfinding
 * 寻路的缓存类
 */
var PathCache = function(opts) {
	this.id = id++;
	this.limit = opts.limit||30000;
	this.size = 0;
	//排序方法
	this.queue = new PriorityQueue(comparator);
	this.cache = {};
};

var pro = PathCache.prototype;

/**
 * Get a path from cache
 * 从缓存中获取路径
 * @param x1, y1 {Number} Start point of path 起点
 * @param x2, y2 {Number} End point of path  终点
 * @return {Object} The path in cache or null if no path exist in cache.
 * @api public
 */
pro.getPath = function(x1, y1, x2, y2) {
	//路径的key
	var key = this.genKey(x1, y1, x2, y2);
	
	if(!!this.cache[key]) {
		return this.cache[key];
	}
		
	return null;
};

/**
 * Generate key for given path, for a path can be identified by start and end point, we use then to construct the key
 * @param x1, y1 {Number} Start point of path
 * @param x2, y2 {Number} End point of path
 * @return {String} The path's key
 * @api public
 */
pro.genKey = function(x1, y1, x2, y2) {
	return x1 + '_' + y1 + '_' + x2 + '_' + y2;
};

/**
 * Add a path to cache
 * 储存一个路径到缓存
 * @param x1, y1 {Number} Start point of path
 * @param x2, y2 {Number} End point of path
 * @param path {Object} The path to add
 * @api public
 */
pro.addPath = function(x1, y1, x2, y2, path) {
	var key = this.genKey(x1, y1, x2, y2);
		
	if(!!this.cache[key]) {
		//如果路径存在，则只是更新路径
		this.cache[key] = path;
		this.cache[key].update = true;
		this.cache[key].time = Date.now();
	} else if(this.size < this.limit) {
		//把key按照优先顺序存入queue的队列数组中
		this.queue.offer({
			time : Date.now(),
			key : key
		});
		
		this.cache[key] = path;
		this.size++;
	} else if(this.size === this.limit) {
		//如果缓存超额，先更新key的时间，按时间顺序从新排列key（最新时间的在首位，最久时间的在末位），
		//删除末位的key，并加入最新的key，并增删对应的cache[key]
		var delKey = this.queue.pop().key;
		while(this.cache[delKey].update === true) {
			this.queue.offer({
				time : this.cache[delKey].time,
				key : delKey
			});
			
			delKey = this.queue.pop();
		}
		
		delete this.cache[delKey];
		
		this.queue.offer({
			time : Date.now(),
			key : key
		});
		
		this.cache[key] = path;
	}
};

//按时间先后排序，需要说明的是queue排好序后，执行了反序列，最先加入的去了末位
var comparator = function(a, b) {
	return a.time < b.time;
};

module.exports = PathCache;
