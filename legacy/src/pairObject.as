package
{
	//the pair object class establishes a relationship between 2 objects in game.
	public class pairObject
	{	
		public var trigger:Object;
		public var target:Object;
		public var type:String;
		public var triggered:Boolean = false;
		
		public function pairObject(_trigger:Object=null, _target:Object=null, _type:String=null)
		{
			trigger = _trigger;
			target = _target;
			type = _type;
			triggered = false;
		}
	}
}