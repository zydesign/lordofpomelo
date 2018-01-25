__resources__["/app.js"] = {meta: {mimetype: "application/javascript"}, data: function(exports, require, module, __filename, __dirname) {
	var switchManager = require('switchManager');	// page switch manager
	var ui = require('ui');
	var Area = require('area');
	var ResMgr = require('resmgr').ResMgr;
	var ObjectPoolManager = require('objectPoolManager');
	var chat = require('chat');
	var view = require("view");
	var director = require('director');
	var helper = require("helper");
	var pomelo = window.pomelo;

	var inited = false;     //是否已经初始化
	var skch = null;
	var gd = null;
	var gv = null;
	var area = null;
	var resMgr = null;
	var poolManager = null;
	var delayTime = null;

	/**
	 * Init client ara
	 * @param data {Object} The data for init area
	 */
	
	//根据data数据初始化场景数据，进入场景（clientManager的enterScene调用该函数）
	//参数data：{entities: 玩家附近实体, curPlayer: player.getInfo(),  map: {}}
	function init(data) {
		var map = data.map;
		pomelo.player = data.curPlayer;               //重新配置pomelo.player
		switchManager.selectView('gamePanel');        //显示游戏面板
		//如果已经执行过初始化
		if(inited){
			configData(data);
			area = new Area(data, map);     //实例场景
		}else{
		//如果未执行过初始化
			initColorBox();                 //打开视图引擎
			configData(data);               //给参数data添加引擎画布属性
			area = new Area(data, map);     //使用配置过的data，实例场景

			area.run();                     //运行场景
			chat.init();                    //聊天初始化

			inited = true;   //改为已初始化
		}
    ui.init();
	}

	/**
	 * Init color box, it will init the skch, gv, gd
	 * @api private
	 */
	function initColorBox(){
		if(!skch){
			var width = parseInt(getComputedStyle(document.getElementById("m-main")).width);    //获取宽度
			var height = parseInt(getComputedStyle(document.getElementById("m-main")).height);  //获取高度
			skch = helper.createSketchpad(width, height, document.getElementById("m-main"));    //创建画布
			skch.cmpSprites = cmpSprites;   //比较精灵
		}

		gv = new view.HonestView(skch);      //新建视图
		gv.showUnloadedImage(false);         //不显示未加载图片
		gd = director.director({             //导演开启游戏
			view: gv
		});
	}

	//获取场景
	function getArea() {
		return area;
	}

	/**
	 * Get current player
	 */
	//获取当前玩家
	function getCurPlayer() {
		return getArea().getCurPlayer();
	}

	//
	function getResMgr(){
		if(!resMgr){
			resMgr = new ResMgr();
		}

		return resMgr;
	}

	//获取对象池管理
	function getObjectPoolManager() {
		if (!poolManager) {
			poolManager = new ObjectPoolManager();
		}
		return poolManager;

	}

	//设置延迟时间
	function setDelayTime(time) {
		delayTime = time;
	}

	//获取延迟时间
	function getDelayTime() {
		return delayTime;
	}

	/**
	 * Reconfig the init data for area
	 * @param data {Object} The init data for area
	 * @api private
	 */
	//配置数据，给参数添加属性------------------------------------------------------------------【配置数据】
	function configData(data){
		data.skch = skch;
		data.gd = gd;
		data.gv = gv;
	}

	var cmpSprites = function(s1, s2) {
		var m1 = s1.exec('matrix');
		var m2 = s2.exec('matrix');
		var dz = m1.tz - m2.tz;
		if(dz === 0) {
			var dy = m1.ty - m2.ty;
			if(dy === 0) {
				return m1.tx - m2.tx;
			}
			return dy;
		}
		return dz;
	};

	exports.init = init;
	exports.getResMgr = getResMgr;
	exports.getObjectPoolManager = getObjectPoolManager;
	exports.setDelayTime = setDelayTime;
	exports.getDelayTime = getDelayTime;
	exports.getCurArea = getArea;
	exports.getCurPlayer = getCurPlayer;
}};
