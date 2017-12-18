var messageService = require('./../messageService');
var api = require('../../util/dataApi');
var Move = require('./../action/move');
var consts = require('../../consts/consts');
var Revive = require('./../action/revive');
var executeTask = require('./../executeTask');
var EntityType = require('../../consts/consts').EntityType;
var logger = require('pomelo-logger').getLogger(__filename);

var exp = module.exports;

/**
 * Register event handler for character
 */
//添加角色基类注册事件（玩家、怪物），player和mobs都是继承Character的，可以直接使用
exp.addEventForCharacter = function(character) {
	/**
	 * Move event handler
	 */
	//注册角色“移动”事件
	character.on('move', function(args){
		var character = args.character;
		var area = character.area;
		var speed = character.walkSpeed;
		var paths = args.paths;
		//生成移动行为，只要角色发射了移动事件，action.updata就会生成移动动作并广播消息
		var action = new Move({
			entity: character,
			path: paths.path,
			speed: speed
		});

		//Add move action to action manager
		//把生成的动作加入actionManager动作管理器，方便updata，并广播消息给aoi附近玩家（updata移动动作只给自己发了消息而已）
		if(area.timer.addAction(action)){
			//aoi广播消息----------------------------------
			messageService.pushMessageByAOI(area, {
				route: 'onMove',
				entityId: character.entityId,
				path: paths.path,
				speed: speed
			}, {x:character.x, y:character.y});
		}
	});

	/**
	 * Attack event handler, the event handler will handle the attack result
	 */
	//注册角色“攻击”事件
	character.on('attack', function(args){
		var result = args.result;
		var attacker = args.attacker;
		var target = args.target;
		var area = target.area;
		var timer = area.timer;
		var attackerPos = {x: attacker.x, y: attacker.y};

		//Print an error when attacker or target not exist, this should not happened!
		if(!target || !attacker){
			logger.error('args : %j, attacker : %j, target : %j', args, attacker, target);
			return;
		}
		var msg = {
			route : 'onAttack',
			attacker : attacker.entityId,
			target : target.entityId,
			result: args.result,    //使用技能攻击返回的结果
			skillId: args.skillId
		};

		//If the attack killed the target, then do the clean up work
		//如果攻击致死的，
		if(result.result === consts.AttackResult.KILLED){
			//更新任务数据
			executeTask.updateTaskData(attacker, target);
			//如果攻击目标是怪物，场景删除该怪物，增加玩家经验，怪物掉落道具加入场景中
			if(target.type === EntityType.MOB){
				area.removeEntity(target.entityId);
				msg.exp = attacker.experience;
				for(var id in result.items){
					area.addEntity(result.items[id]);
				}
			} else {
				//clear the target and make the mobs forget him if player die
				//如果是怪物攻击玩家致死的，这里的target是玩家，先玩家解除锁定怪物，然后玩家的敌人组（怪物）放弃对玩家的仇恨
				target.target = null;  //这个是玩家解锁目标
				target.forEachEnemy(function(hater) {
					hater.forgetHater(target.entityId);
				});
				//玩家清除仇恨，玩家死亡为true
				target.clearHaters();

				target.died = true;

				//Abort the move action of the player
				//停止玩家的所有动作
				timer.abortAllAction(target.entityId);

				//Add revive action
				//增加一个死亡动作到actionManager动作管理器
				timer.addAction(new Revive({
					entity : target,
					reviveTime : consts.PLAYER.reviveTime,
					map : area.map
				}));

				//增加一个死亡时间属性
				msg.reviveTime = consts.PLAYER.reviveTime;

				//发射储存事件，同步数据到数据库
				target.save();
			}

			attacker.target = null;
			//aoi广播死亡消息...............................................
			messageService.pushMessageByAOI(area, msg, attackerPos);
			
			//如果攻击结果没有致死，而是攻击成功的
		} else if(result.result === consts.AttackResult.SUCCESS) {
			if (!target) {
				logger.error('[onattack] attack result: target is null!	attackerId: ' + attacker.entityId + '	targetId: ' + target.entityId +' result: ' + result);
				return;
			}
			//如果攻击目标为怪物，怪物加入aiManager，从巡逻状态转换为ai状态
			if(target.type === EntityType.MOB) {
				timer.enterAI(target.entityId);
			}
			//广播消失给aoi附近玩家------------------------------------------
			messageService.pushMessageByAOI(area, msg, attackerPos);
		}
	});
};
