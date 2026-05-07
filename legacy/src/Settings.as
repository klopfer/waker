/*************************
 * 
 * Gameplay parameters set before the build
 * to be made available globally.
 * 
 *************************/
 
 package
{
	
	public class Settings
	{
	
	
		//easy = 1; medium = 2; hard = 3
		public static var LEVEL_DIFFICULTY:int = 2;
		public static var LEVEL_DIFFICULTY_PREVIOUS:int = 2;
		
		public static var inGame:Boolean = false;
		
		public static var ABSTRACT_MODE:Boolean = false;
		
		public static var graphCountDown:Boolean = false;
		
		public static var isItACutScene:Boolean = true;
		
		public static var gameEnds:Boolean = false;
		
		public static var BGM_VOLUME_DEFAULT:Number = 0.5;
		public static var SFX_VOLUME_DEFAULT:Number = 0.5;
		
		public static var escPressed:Boolean = false;
		
		public static var playerVisible:Boolean = false;
		
		public function Settings()
		{
		}

	}
}
