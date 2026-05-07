/**
 * 
 * Built from examples found at: http://evolve.reintroducing.com/2007/10/23/as3/as3-custom-events/
 * by Matt Przybylski [http://www.reintroducing.com]
 * 
 **/
 
package
{
	import flash.events.Event;
  			
	public class CustomEvent extends Event
	{

//- PRIVATE & PROTECTED VARIABLES -------------------------------------------------------------------------

//- PUBLIC & INTERNAL VARIABLES ---------------------------------------------------------------------------

        // event constants
        public static const ON_ENTRANCE_SET:String = "onEntranceSet";

        public var params:Object;

//- CONSTRUCTOR -------------------------------------------------------------------------------------------

	    public function CustomEvent($type:String, $params:Object, $bubbles:Boolean = false, $cancelable:Boolean = false)
	    {
	        super($type, $bubbles, $cancelable);
	
	        this.params = $params;
	    }

//- PRIVATE & PROTECTED METHODS ---------------------------------------------------------------------------
//- PUBLIC & INTERNAL METHODS -----------------------------------------------------------------------------
//- EVENT HANDLERS ----------------------------------------------------------------------------------------
//- GETTERS & SETTERS -------------------------------------------------------------------------------------

//- HELPERS -----------------------------------------------------------------------------------------------

        public override function clone():Event
        {
            return new CustomEvent(type, this.params, bubbles, cancelable);
        }
         
        public override function toString():String
        {
            return formatToString("CustomEvent", "params", "type", "bubbles", "cancelable");
        }
		
	}
}

