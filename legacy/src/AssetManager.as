package
{
	import flash.display.MovieClip;
	
	public class AssetManager
	{

		/**
		 * !!!! READ ME !!!!
		 * 
		 * How to toggle between story and abstract
		 * 
		 * find "/story/" and replace with "/story/" in this entire document
		 * 
		 **/
		  
		 
		/**
		 * 
		 *  ART ASSETS
		 *  Common to both versions
		 * 
		 **/

		
		
		[Embed (source="/story/misc/1px.png")] 
		public static const OnePx:Class;

		/**
		 * 
		 *  ART ASSETS
		 *  Narrative version
		 * 
		 **/
		
		//Splash
		[Embed (source="/story/splash/gambitlogo.swf")]
		public static const gambitClass:Class;
		[Embed (source="/story/splash/poofLogo.png")]
		public static const poofClass:Class;
		
		//Mouse
		[Embed (source="/story/gui/menu/cursor.png")]
		public static const cursorImg:Class;
		
		// Main Menu
		[Embed (source="/story/gui/menu/start.png")]
		public static const guiBtnStart:Class; // button idle
		[Embed (source="/story/gui/menu/start_mouseover.png")]
		public static const guiBtnStartMo:Class; // button clicked	
		[Embed (source="/story/gui/menu/instructions.png")]
		public static const guiBtnInstruct:Class; // button idle
		[Embed (source="/story/gui/menu/instructions_mouseover.png")]
		public static const guiBtnInstructMo:Class; // button clicked
		
		[Embed (source="/story/gui/menu/menuBG.jpg")]
		public static const guiMenuBG:Class; // main menu bg
		 
		
		[Embed (source="/story/gui/menu/credits.png")]
		public static const guiBtnCredits:Class; // button idle
		[Embed (source="/story/gui/menu/credits_mouseover.png")]
		public static const guiBtnCreditsMo:Class; // button clicked	

		[Embed (source="/story/gui/menu/settings.png")]
		public static const guiBtnSettings:Class; // button idle
		[Embed (source="/story/gui/menu/settings_mouseover.png")]
		public static const guiBtnSettingsMo:Class; // button clicked
				
		[Embed (source="/story/gui/menu/difficulty_easy.png")]
		public static const guiBtnEasy:Class; // button easy
		[Embed (source="/story/gui/menu/difficulty_easy_mouseover.png")]
		public static const guiBtnEasyMO:Class; // button easy mouse over
		[Embed (source="/story/gui/menu/difficulty_easy_selected.png")]
		public static const guiBtnEasySelected:Class; // button easy selected

		[Embed (source="/story/gui/menu/difficulty_medium.png")]
		public static const guiBtnMedium:Class; // button easy
		[Embed (source="/story/gui/menu/difficulty_medium_mouseover.png")]
		public static const guiBtnMediumMO:Class; // button easy mouse over
		[Embed (source="/story/gui/menu/difficulty_medium_selected.png")]
		public static const guiBtnMediumSelected:Class; // button easy selected
		
		[Embed (source="/story/gui/menu/difficulty_hard.png")]
		public static const guiBtnHard:Class; // button easy
		[Embed (source="/story/gui/menu/difficulty_hard_mouseover.png")]
		public static const guiBtnHardMO:Class; // button easy mouse over
		[Embed (source="/story/gui/menu/difficulty_hard_selected.png")]
		public static const guiBtnHardSelected:Class; // button easy selected
		
		[Embed (source="/story/gui/menu/settings_screen.swf")]
		public static const guiOptionsScreenBG:Class; //GUI BG for the difficulty screen

		[Embed (source="/story/gui/menu/instructions_screen.swf")]
		public static const guiInstructionScreen:Class;
		[Embed (source="/story/gui/menu/credits_screen.swf")]
		public static const guiCreditsScreen:Class;
		
		
		// In Game GUI
		[Embed (source="/story/gui/in-game/GUIoption_bg.swf")] 
		public static const guiOption_bg:Class; // background of in game menu
		[Embed (source="/story/gui/in-game/option.png")] 
		public static const guiBtnOptions:Class; // button idle
		[Embed (source="/story/gui/in-game/option_pressed.png")]
		public static const guiBtnOptionsPressed:Class; // button clicked
		
		//Hints									
		[Embed (source="/story/gui/in-game/hints/level_displacement0_hint.swf")]
		public static const level_displacement0_hint:Class; //hint for level d0
		[Embed (source="/story/gui/in-game/hints/level_displacement1_hint.swf")]
		public static const level_displacement1_hint:Class; //hint for level d1
		[Embed (source="/story/gui/in-game/hints/level_displacement2_hint.swf")]
		public static const level_displacement2_hint:Class; //hint for level d2
		[Embed (source="/story/gui/in-game/hints/level_displacement3_hint.swf")]
		public static const level_displacement3_hint:Class; //hint for level d3
		[Embed (source="/story/gui/in-game/hints/level_velocity0_hint.swf")]
		public static const level_velocity0_hint:Class;
		[Embed (source="/story/gui/in-game/hints/level_velocity1_hint.swf")]
		public static const level_velocity1_hint:Class;
		[Embed (source="/story/gui/in-game/hints/level_velocity2_hint.swf")]
		public static const level_velocity2_hint:Class;
		[Embed (source="/story/gui/in-game/hints/level_velocity3_hint.swf")]
		public static const level_velocity3_hint:Class;
		[Embed (source="/story/gui/in-game/hints/level_mixed0_hint.swf")]
		public static const level_mixed0_hint:Class;
		[Embed (source="/story/gui/in-game/hints/level_mixed1_hint.swf")]
		public static const level_mixed1_hint:Class;
		[Embed (source="/story/gui/in-game/hints/level_mixed2_hint.swf")]
		public static const level_mixed2_hint:Class;
		[Embed (source="/story/gui/in-game/hints/level_mixed3_hint.swf")]
		public static const level_mixed3_hint:Class;
		[Embed (source="/story/gui/in-game/hints/level_hintsign.swf")]
		public static const level_hintsign:Class;
		
		//cheat image
		[Embed (source="/story/misc/cheat.png")]
		public static const cheatSourceFile:Class;
		
		//helps image
		[Embed (source="/story/help/+S.swf")]
		public static const help_image_Plus_S:Class;
		[Embed (source="/story/help/D.swf")]
		public static const help_image_D:Class;
		[Embed (source="/story/help/L.swf")]
		public static const help_image_L:Class;
		[Embed (source="/story/help/R.swf")]
		public static const help_image_R:Class;
		[Embed (source="/story/help/pointRIGHT.swf")]
		public static const help_image_pointRight:Class;
		[Embed (source="/story/help/spacebar.swf")]
		public static const help_image_spacebar:Class;
		
		
		
		
		// Return
		[Embed (source="/story/gui/in-game/return.png")]
		public static const guiBtnContinue:Class; // button idle
		[Embed (source="/story/gui/in-game/return_pressed.png")]
		public static const guiBtnContinuePressed:Class; // button clicked
		[Embed (source="/story/gui/in-game/return_mouseover.png")]
		public static const guiBtnContinueMO:Class; // button mouse over		
		// Instruction
		[Embed (source="/story/gui/in-game/instructions.png")]
		public static const guiBtnInstructions:Class; // button idle
		[Embed (source="/story/gui/in-game/instructions_pressed.png")]
		public static const guiBtnInstructionsPressed:Class; // button clicked
		[Embed (source="/story/gui/in-game/instructions_mouseover.png")]
		public static const guiBtnInstructionsMO:Class; // button mouse over
		// Sound
		[Embed (source="/story/gui/in-game/settings.png")]
		public static const guiBtnSound:Class; // button idle
		[Embed (source="/story/gui/in-game/settings_pressed.png")]
		public static const guiBtnSoundPressed:Class; // button clicked
		[Embed (source="/story/gui/in-game/settings_mouseover.png")]
		public static const guiBtnSoundMO:Class; // button mouse over		
		// Restart
		[Embed (source="/story/gui/in-game/restart.png")]
		public static const guiBtnRestart:Class; // button idle
		[Embed (source="/story/gui/in-game/restart_pressed.png")] // button clicked
		public static const guiBtnRestartPressed:Class;
		[Embed (source="/story/gui/in-game/restart_mouseover.png")] // button mouse over
		public static const guiBtnRestartMO:Class;
		// Quit
		[Embed (source="/story/gui/in-game/quit.png")] // button idle
		public static const guiBtnQuit:Class;
		[Embed (source="/story/gui/in-game/quit_pressed.png")] // button clicked
		public static const guiBtnQuitPressed:Class;		
		[Embed (source="/story/gui/in-game/quit_mouseover.png")] // button mouse over
		public static const guiBtnQuitMO:Class;
						
		[Embed (source="/story/gui/menu/instructions_screen.swf")] // overlay with instructions
		public static const guiInstructionOverlayInGame:Class;

		[Embed (source="/story/gui/in-game/confirmation_screen.swf")] // overlay with yes-no
		public static const guiConfirmationInGameScreen:Class;
		[Embed (source="/story/gui/in-game/confirmation_yes.png")] // confirmation yes
		public static const guiConfirmationYesInGame:Class;
		[Embed (source="/story/gui/in-game/confirmation_no.png")] // confirmation  no
		public static const guiConfirmationNoInGame:Class;
		
		
		// Graph area
		[Embed (source="/story/graph/Glow_Effect_reddishorange.swf")]
		public static const graphBGD:Class; // square displacement graph background
		[Embed (source="/story/graph/Glow_Red_dbl_height.swf")]
		public static const graphBGTD:Class; // tall displacement graph background
		[Embed (source="/story/graph/Glow_Red_dbl_width.swf")]
		public static const graphBGWD:Class; // wide displacement graph background
		[Embed (source="/story/graph/Glow_Yellow.swf")]
		public static const graphBGV:Class; // square velocity graph background
		[Embed (source="/story/graph/Glow_Yellow_dbl_height.swf")]
		public static const graphBGTV:Class; // tall velocity graph background
		[Embed (source="/story/graph/Glow_Yellow_dbl_width.swf")]
		public static const graphBGWV:Class; // wide velocity graph background
		[Embed (source="/story/graph/displacementOrb/origin.swf")]
		public static const displaceOrigin:Class; // object against which displacement is measured
		[Embed (source="/story/graph/displacementOrb/justORB.swf")]
		public static const disOrb:Class; // activation object
	    [Embed (source="/story/graph/displacementOrb/orbEFFECT.swf")]
	    public static const disEffect:Class; // spinning triangles around the activation obj
	    
	    [Embed (source="/story/graph/graphSpark.swf")]
	    public static const graphSpark:Class; // graphSpark when drawing graph
	    [Embed (source="/story/graph/Blink.swf")]
	    public static const graphFlash:Class; // graphFlash when counting down in graph
	    [Embed (source="/story/graph/Blink Tall.swf")]
	    public static const graphFlashTall:Class; // graphFlash when counting down in graph tall
	    [Embed (source="/story/graph/Blink Wide.swf")]
	    public static const graphFlashWide:Class; // graphFlash when counting down in graph wide
	    
	    //velocity orb
	    [Embed (source="/story/graph/velocityOrb/justORB.swf")]
	    public static const velOrb:Class; // activation object
	    [Embed (source="/story/graph/velocityOrb/orbEFFECT.swf")]
	    public static const velEffect:Class; // spinning triangles around the activation obj
		
		// Graph obstacles
		[Embed (source="/story/tempObs/Obstacle.swf")] 
		public static const graphObstacles:Class;
		[Embed (source="/story/tempObs/Portal.swf")] 
		public static const spikeyObjects:Class;
		
		// Level complete
		[Embed (source="/story/misc/levelcomplete.swf", symbol="levelcomplete")]
		public static const levelCompleteClass:Class;		
		public static const levelComplete:MovieClip = new levelCompleteClass();
		// Level complete for cutscene
		[Embed (source="/story/misc/levelcomplete_cutscene.swf", symbol="levelcompleteCS")]
		public static const levelCompleteCutSceneClass:Class;		
		public static const levelComplete_CutScene:MovieClip = new levelCompleteCutSceneClass();
		
		//[Embed (source="/story/misc/levelcomplete_cutscene.swf", symbol="levelcompleteCS")]
		//public static const levelCompleteCSClass:Class;		
		//public static const levelCompleteCS:MovieClip = new levelCompleteCSClass();
		
		// Level backgrounds
		[Embed (source="/story/background/levelTD_bg.swf")]
		public static const bgWorld1_t:Class;
		[Embed (source="/story/background/leveld1_bg.swf")]
		public static const bgWorld1_1:Class;
		[Embed (source="/story/background/leveld2_bg.swf")]
		public static const bgWorld1_2:Class;
		[Embed (source="/story/background/leveld3_bg.swf")]
		public static const bgWorld1_3:Class;
		
		[Embed (source="/story/background/levelTV_bg.swf")]
		public static const bgWorld2_t:Class;
		[Embed (source="/story/background/levelv1_bg.swf")]
		public static const bgWorld2_1:Class;
		[Embed (source="/story/background/levelv2_bg.swf")]
		public static const bgWorld2_2:Class;
		[Embed (source="/story/background/levelv3_bg.swf")]
		public static const bgWorld2_3:Class;
		
		[Embed (source="/story/background/levelm1_bg.swf")]
		public static const bgWorld3_1:Class;
		[Embed (source="/story/background/levelm2_bg.swf")]
		public static const bgWorld3_2:Class;
		[Embed (source="/story/background/levelm3_bg.swf")]
		public static const bgWorld3_3:Class;
		[Embed (source="/story/background/levelm4_bg.swf")]
		public static const bgWorld3_4:Class;
		
		// cutscene
		[Embed (source="/story/cutscenes/intro.swf", symbol="intro")]
		public static const introCutScene:Class;
		[Embed (source="/story/cutscenes/pre_world1.swf")]
		public static const preDisplacementCutScene:Class;
		[Embed (source="/story/cutscenes/pre_world2.swf")]
		public static const preVelocityCutScene:Class;
		[Embed (source="/story/cutscenes/pre_world3.swf")]
		public static const preMixedCutScene:Class;
		[Embed (source="/story/cutscenes/ending.swf", symbol="gameEnding")]
		public static const endingCutSceneClass:Class;
		public static const endingCutScene:MovieClip = new endingCutSceneClass();
		
		// Collision maps
		// displacement levels
		[Embed (source="/story/collision/levelTD_ground.png")]
		public static const levelTD_collision:Class;
		[Embed (source="/story/collision/leveld1_ground.png")]
		public static const leveld1_collision:Class;
		[Embed (source="/story/collision/leveld2_collision.png")]
		public static const leveld2_collision:Class;
		[Embed (source="/story/collision/leveld3_ground.png")]
		public static const leveld3_collision:Class;
		// velocity levels
		[Embed (source="/story/collision/leveltv_collision.png")]				
		public static const leveltv_collision:Class;
		[Embed (source="/story/collision/levelv1_ground.png")]
		public static const levelv1_collision:Class;
		[Embed (source="/story/collision/levelv1_ground_easy.png")]
		public static const levelv1_easy_collision:Class;
		[Embed (source="/story/collision/levelv3_ground.png")]
		public static const levelv3_collision:Class;
		[Embed (source="/story/collision/levelv3_ground_medium.png")]
		public static const levelv3_collision_medium:Class;
		[Embed (source="/story/collision/levelv3_ground_easy.png")]
		public static const levelv3_collision_easy:Class;
		[Embed (source="/story/collision/levelv4_ground.png")]				
		public static const levelv4_collision:Class;
		// mixed displ / vel levels
		[Embed (source="/story/collision/levelm3_ground_easy.png")]
		public static const levelm3_easy_collision:Class;
		[Embed (source="/story/collision/levelm4_ground.png")]
		public static const levelm4_collision:Class;
		[Embed (source="/story/collision/levelm5_ground.png")]				
		public static const levelm5_collision:Class;		
		[Embed (source="/story/collision/levelm6_ground.png")]				
		public static const levelm6_collision:Class;		
		// cutscenes
		[Embed (source="/story/collision/cutscene_ground.png")]				
		public static const cutScene_collision:Class;
		
		// Exit
		[Embed (source="/story/props/exit.swf")]
		public static const exit:Class;
		[Embed (source="/story/props/exitcutscene.swf")]
		public static const exitCutScene:Class;
		
		// Entrance
		[Embed (source="/story/props/placeholder_entrance.png")]
		public static const entrance:Class;
		
		// Avatar
		
		[Embed (source="/story/sprite/avatarDOWNcollision.swf")]
		public static const downAura:Class;
		[Embed (source="/story/sprite/avatarUPcollision.swf")] 
		public static const upAura:Class;
		[Embed (source="/story/sprite/avatarLEFTcollision.swf")]
		public static const leftAura:Class;
		[Embed (source="/story/sprite/avatarRIGHTcollision.swf")] 
		public static const rightAura:Class;
		
		[Embed (source="/story/sprite/avatarSheet.swf")] 
		public static const avatarSprite:Class;
		
		[Embed (source="/story/graph/displacementOrb/ORBpicked L.swf")] 
		public static const inventryOrbDL:Class; // inventry displacement orb left
		[Embed (source="/story/graph/displacementOrb/ORBpicked R.swf")] 
		public static const inventryOrbDR:Class; // inventry displacement orb right
		
		[Embed (source="/story/graph/velocityOrb/ORBpicked L.swf")] 
		public static const inventryOrbVL:Class; // inventry velocity orb left
		[Embed (source="/story/graph/velocityOrb/ORBpicked R.swf")] 
		public static const inventryOrbVR:Class; // inventry velocity orb right
		
		[Embed (source="/story/graph/velocityOrb/pointer.swf")] 
		public static const velocityArrowStand:Class; // inventry velocity orb right
		
		[Embed (source="/story/misc/hitEffect.swf")]
		public static const hitEffectClass:Class; //the picture to show after player got hit
		public static const hitEffect:MovieClip = new hitEffectClass();

		/**
		 * 
		 *  AUDIO ASSETS
		 *  Narrative version
		 *  
		 **/
				
		// Background music
		// , symbol="level1BGM"
		[Embed(source="/story/bgm/world01.swf", symbol="world01")]
		public static const bgmWorld1:Class;
		
		[Embed(source="/story/bgm/world02.swf", symbol="world02")]
		public static const bgmWorld2:Class;
		
		[Embed(source="/story/bgm/world03.swf", symbol="world03")]
		public static const bgmWorld3:Class;
		
		[Embed(source="/story/bgm/menu.swf", symbol="menu02")]
		public static const menu:Class;
		
		[Embed(source="/story/bgm/cutscene01.swf", symbol="cutscene01")]
		public static const bgmCutscene01:Class;

		[Embed(source="/story/bgm/endgame.mp3")]
		public static const bgmEndGame:Class;		
				
		// Sound effects
		[Embed (source="/story/sfx/poof.mp3")] 
		public static const sfxPoof:Class; // poof logo sound

		[Embed (source="/story/sfx/player/player_orbremove.mp3")] 
		public static const sfxRemove:Class; // player removes object from holder

		[Embed (source="/story/sfx/player/drop/player_drop_cloudorb.mp3")] 
		public static const sfxDrop:Class; // player drops object
		
		[Embed (source="/story/sfx/player/pickup/player_pickup_cloudorb.mp3")]
		public static const sfxPickup:Class; // player picks up object
		
		[Embed (source="/story/sfx/player/player_hurt.mp3")]
		public static const sfxHurt:Class; // player is hurt
		
		[Embed (source="/story/sfx/graph/graph_draw.swf", symbol="graph_draw")]
		public static const sfxGraphDraw:Class; // graph drawing

		[Embed (source="/story/sfx/graph/graph_reset.mp3")]
		public static const sfxGraphReset:Class; // graph resets
		
		[Embed (source="/story/sfx/switch/switch_one.mp3")]
		public static const sfxSwitchOne:Class; // switch state one	
		
		[Embed (source="/story/sfx/switch/switch_two.mp3")]
		public static const sfxSwitchTwo:Class; // switch state two	

		[Embed (source="/story/sfx/victory.mp3")]
		public static const sfxWin:Class; // player completes the level
		
		[Embed (source="/story/sfx/cutscene_victory.mp3")]
		public static const sfxWinCS:Class; // player completes the level
		
		[Embed(source="/story/sfx/player/player_sprint.swf", symbol="player_sprint")]
		public static const sfxPlayerSprint:Class; // player sprints
		
		[Embed(source="/story/sfx/player/player_walk.swf", symbol="player_walk")]
		public static const sfxPlayerWalk:Class; // player walks
	
		
		//jump Sounds
		[Embed (source="/story/sfx/player/jump/player_jump_01.mp3")]
		public static const sfxJump01:Class; // player jump 01
		[Embed (source="/story/sfx/player/jump/player_jump_02.mp3")]
		public static const sfxJump02:Class; // player jump 02
		[Embed (source="/story/sfx/player/jump/player_jump_03.mp3")]
		public static const sfxJump03:Class; // player jump 03
		[Embed (source="/story/sfx/player/jump/player_jump_04.mp3")]
		public static const sfxJump04:Class; // player jump 04
		[Embed (source="/story/sfx/player/jump/player_jump_05.mp3")]
		public static const sfxJump05:Class; // player jump 05
		
		public static const sfxJumps:Array = new Array( 
			new sfxJump01(),
			new sfxJump02(),
			new sfxJump03(),
			new sfxJump04(),
			new sfxJump05()
			);
			
		//landing Sounds
		[Embed (source="/story/sfx/player/land/player_land_01.mp3")]
		public static const sfxLand01:Class; // player land 01
		[Embed (source="/story/sfx/player/land/player_land_02.mp3")]
		public static const sfxLand02:Class; // player land 02
		[Embed (source="/story/sfx/player/land/player_land_03.mp3")]
		public static const sfxLand03:Class; // player land 03
		[Embed (source="/story/sfx/player/land/player_land_04.mp3")]
		public static const sfxLand04:Class; // player land 04
		[Embed (source="/story/sfx/player/land/player_land_05.mp3")]
		public static const sfxLand05:Class; // player land 05
		
		public static const sfxLandings:Array = new Array( 
			new sfxLand01(),
			new sfxLand02(),
			new sfxLand03(),
			new sfxLand04(),
			new sfxLand05()
			);
			
/*		//footstep Sounds
		[Embed (source="/story/sfx/player/footsteps/player_footstep_01.mp3")]
		public static const sfxFootstep01:Class; // player footsteps 01
		[Embed (source="/story/sfx/player/footsteps/player_footstep_02.mp3")]
		public static const sfxFootstep02:Class; // player footsteps 02
		[Embed (source="/story/sfx/player/footsteps/player_footstep_03.mp3")]
		public static const sfxFootstep03:Class; // player footsteps 03
		[Embed (source="/story/sfx/player/footsteps/player_footstep_04.mp3")]
		public static const sfxFootstep04:Class; // player footsteps 04
		[Embed (source="/story/sfx/player/footsteps/player_footstep_05.mp3")]
		public static const sfxFootstep05:Class; // player footsteps 05
		[Embed (source="/story/sfx/player/footsteps/player_footstep_06.mp3")]
		public static const sfxFootstep06:Class; // player footsteps 06
		[Embed (source="/story/sfx/player/footsteps/player_footstep_07.mp3")]
		public static const sfxFootstep07:Class; // player footsteps 07
		[Embed (source="/story/sfx/player/footsteps/player_footstep_08.mp3")]
		public static const sfxFootstep08:Class; // player footsteps 08
		[Embed (source="/story/sfx/player/footsteps/player_footstep_09.mp3")]
		public static const sfxFootstep09:Class; // player footsteps 09
		[Embed (source="/story/sfx/player/footsteps/player_footstep_10.mp3")]
		public static const sfxFootstep10:Class; // player footsteps 10
		
		public static const sfxFootsteps:Array = new Array( 
			new sfxFootstep01(),
			new sfxFootstep02(),
			new sfxFootstep03(),
			new sfxFootstep04(),
			new sfxFootstep05(),
			new sfxFootstep06(),
			new sfxFootstep07(),
			new sfxFootstep08(),
			new sfxFootstep09(),
			new sfxFootstep10()
			);
			
*/

		//gui sounds

		//ui mouseover Sounds
		[Embed (source="/story/sfx/ui/ui_mouseover_01.mp3")]
		public static const sfxMenuMO01:Class; // ui mouseover 01
		[Embed (source="/story/sfx/ui/ui_mouseover_02.mp3")]
		public static const sfxMenuMO02:Class; // ui mouseover 02
		[Embed (source="/story/sfx/ui/ui_mouseover_03.mp3")]
		public static const sfxMenuMO03:Class; // ui mouseover 03
		[Embed (source="/story/sfx/ui/ui_mouseover_04.mp3")]
		public static const sfxMenuMO04:Class; // ui mouseover 04
		
		public static const sfxMenuMO:Array = new Array( 
			new sfxMenuMO01(),
			new sfxMenuMO02(),
			new sfxMenuMO03(),
			new sfxMenuMO04()
			);
			
		//ui select Sounds
		[Embed (source="/story/sfx/ui/ui_select_01.mp3")]
		public static const sfxMenuSelect01:Class; // ui select 01
		[Embed (source="/story/sfx/ui/ui_select_02.mp3")]
		public static const sfxMenuSelect02:Class; // ui select 02
		[Embed (source="/story/sfx/ui/ui_select_03.mp3")]
		public static const sfxMenuSelect03:Class; // ui select 03
		[Embed (source="/story/sfx/ui/ui_select_04.mp3")]
		public static const sfxMenuSelect04:Class; // ui select 04
		
		public static const sfxMenuSelect:Array = new Array( 
			new sfxMenuSelect01(),
			new sfxMenuSelect02(),
			new sfxMenuSelect03(),
			new sfxMenuSelect04()
			);
		
		[Embed (source="/story/sfx/ui/ui_gamestart.mp3")]
		public static const sfxGameStart:Class; // main menu start game select
		
		[Embed (source="/story/dialogue/gameintro.mp3")]
		public static const voIntro:Class; //intro voice over.
		
		[Embed (source="/story/dialogue/skyintro.mp3")]
		public static const voCS1:Class; // cutscene 1 voice over.
		
		[Embed (source="/story/dialogue/earthintro.mp3")]
		public static const voCS2:Class; // cutscene 2 voice over.
		
		[Embed (source="/story/dialogue/starintro.mp3")]
		public static const voCS3:Class; // cutscene 3 voice over.
		
		
		//image for the switch and switch obstacles
		[Embed (source="/story/switch/switch_mode_1.swf")]
		public static const switchMode1:Class;
		[Embed (source="/story/switch/switch_mode_2.swf")]
		public static const switchMode2:Class; 
		[Embed (source="/story/tempObs/obs_vert80.swf")]
		public static const vertObstacle80:Class;
		[Embed (source="/story/tempObs/obs_vert140.swf")]
		public static const vertObstacle140:Class; 
		[Embed (source="/story/tempObs/obs_vert200.swf")]
		public static const vertObstacle200:Class;
		[Embed (source="/story/tempObs/obs_horz160.swf")]
		public static const horzObstacle160:Class;
		

// Constructor
/*
		private static var instance:AssetManager = null;
		private static var allowInstantiation:Boolean = true;
		private static var list:Array = new Array();
		
		public static const ART_IDLE_RIGHT:int = 0;
		public static const ART_IDLE_LEFT:int = 1;
		public static const ART_RUN_RIGHT:int = 2;
		public static const ART_RUN_LEFT:int = 3;
		
		public function AssetManager()
		{
		}
		
		public static function getInstance():AssetManager
		{
			if(instance == null && allowInstantiation == true)
			{
				trace("Asset manager created");
				instance = new AssetManager();
				allowInstantiation = false;
				//var ab:ArtResource = new ArtResource(6);
				//ab.loadResource("Idle_right_playablev2.swf");

				list[ART_IDLE_RIGHT] = new ArtResource(ART_IDLE_RIGHT);
				trace("in constructor: " +ArtResource(list[ART_IDLE_RIGHT]));
				ArtResource(list[ART_IDLE_RIGHT]).loadResource("./assets/sprite/Idle_right_playablev2.swf");
				
				list[ART_IDLE_LEFT] = new ArtResource(ART_IDLE_LEFT);
				ArtResource(list[ART_IDLE_LEFT]).loadResource("./assets/sprite/Idle_left_playablev2.swf");
				
				list[ART_RUN_RIGHT] = new ArtResource(ART_RUN_RIGHT);
				ArtResource(list[ART_RUN_RIGHT]).loadResource("./assets/sprite/character run_right_playablev2.swf");
				
				list[ART_RUN_LEFT] = new ArtResource(ART_RUN_LEFT);
				ArtResource(list[ART_RUN_LEFT]).loadResource("./assets/sprite/character run_left_playablev2.swf");					
			}
			
			return instance;
		}
				
		public function getArtResource(id:int):SWFLoader
		{
			var temp:ArtResource = list[id];
			trace("temp=" +temp);
			return temp.getResource();
		}
		
		public function ResourceManager():void
		{
			if(!allowInstantiation)
				throw new Error("Error: Instantiation failed: Use SingletonDemo.getInstance() instead of new.");
		}
		
		public function numTotalAssets():int
		{
			return list.length;
		}
		
		public function numReadyAssets():int
		{
			var count:int = 0;
			for(var i:int=0; i<list.length; i++)
			{
				var temp:ArtResource = list[i];
				if(temp.isDataReady())
					count++;	
			}
			
			return count;
		}		
*/
	}
}
