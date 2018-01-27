__resources__["/animation.js"] = {meta: {mimetype: "application/javascript"}, data: function(exports, require, module, __filename, __dirname) {

	/**
	 * Module dependencies
	 */

	var FrameAnimation = require('frameanimation').FrameAnimation    //引入帧动画
		, imgAndJsonUrl = require('config').IMAGE_URL            //引入图片网址
		, dataApi = require('dataApi')                           //数据api
		, app = require('app');                                  //app脚本

	/**
	 * Initialize a new 'Animation' with the given 'opts'
	 * 
	 * @param {Object} opts
	 * @api public
	 */

	//动画工厂
	var Animation = function(opts) {
		this.kindId = opts.kindId;     //种类id
		this.type = opts.type;         //类型   （如：player、mob）
		this.name = opts.name;         //帧动画名（如：LeftDownAttack）
	};

	/**
	 * Create animation, each node owns four basic animations
	 * standAnimation, walkAnimation, diedAnimation and attackAnimation
	 *
	 * @api public
	 */
	//创建帧动画 实例
	Animation.prototype.create = function() {
		var animationData = this.getJsonData();                      //获取一份动画数据的帧数据
		var width = parseInt(animationData.width);                   //动画宽度 
		var height = parseInt(animationData.height);                 //动画高度
		var totalFrames = parseInt(animationData.totalFrame);        //动画总帧数 
		var img = this.getImage(), ani;                              //指定动画名的gif图片
		ani = new FrameAnimation({               //通过gif图片及帧数据，生成帧动画实例
			image: img,
			w: width - 5,
			h: height - 5,
			totalTime: totalFrames * 80,
			interval: 80,
			HSpan: width,
			VSpan: height
		});
		ani.name = this.name;                    //帧动画名
		return ani;
	};

	/**
	 * Get animation's jsonData.
	 *
	 * @api public
	 */
	//获取一份动画数据的某帧数据
	Animation.prototype.getJsonData= function() {
		//没有用上type属性
		var id = this.kindId, type = this.type, name = this.name, data;
		data = dataApi.animation.get(id)[name];    //通过种类id得到一份动画数据，然后获取指定帧动画名（如：LeftDownAttack）的帧数据
		if (!!data) {
			return data;
		} else {
			console.error('the jsonData :'+id+'/'+name+'.json is not exist!');
		}
	};

	/**
	 * Get animation's iamge.
	 *
	 * @api public
	 */
	//通过kindId、type、name，从指定网址中获取gif图片
	Animation.prototype.getImage = function() {
		//没有用上type属性
		var id = this.kindId, type = this.type, name = this.name;
		var aniIamgeUrl;
		aniIamgeUrl = imgAndJsonUrl + 'animationPs3/' + id + '/' + name + '.gif';  
		var ResMgr = app.getResMgr();
		var img = ResMgr.loadImage(aniIamgeUrl);  //加载帧动画图片
		if(!!img) {
			return img;
		}else {
			console.error('the iamge :'+id+'/'+name+'.gif is not exist!');
		}
	};

	module.exports = Animation;
}};
