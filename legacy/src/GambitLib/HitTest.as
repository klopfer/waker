package GambitLib 
{
    import flash.display.BitmapData;
    import flash.display.DisplayObject;
    import flash.display.Stage;
    import flash.geom.Matrix;
    import flash.geom.Point;
    import flash.geom.Rectangle;
    
    public class HitTest
    {
        public static var TestBitmapData:BitmapData;

        // Returns true if the two display objects have non-transparent pixels that overlap.
        //  includeStrokes is true if we want to consider strokes on each object.
        public static function pixelsOverlap(object1:DisplayObject, object2:DisplayObject, includeStrokes:Boolean=false):Boolean
        {
            if (null == object1 || null == object2)
                return false;
            
            // Do the bounding boxes intersect?
            if (!object1.hitTestObject(object2))
                return false;  // No!  No hit is possible.

            // Since the bounding boxes intersect, we need to test actual pixels.  First, determine the actual bounding boxes for the two objects.
            var rect1:Rectangle;
            var rect2:Rectangle;
            
            // Snag a bounding box for the object in stage space
            var stage:Stage = object1.stage;
            
            // Are we including any strokes on the object (slightly bigger, therefore slower, but sometimes we want to consider the strokes)
            if (includeStrokes)
            {
              rect1 = object1.getBounds(stage);
              rect2 = object2.getBounds(stage);
            }
            else
            {
              rect1 = object1.getRect(stage);
              rect2 = object2.getRect(stage);
            }
            
            var intersectionRect:Rectangle = rect1.intersection(rect2);
            // This rectangle should always have some size, since hitTestObject returned true.  But to be safe, we check again.
            if (intersectionRect.width <= 0 || intersectionRect.height <= 0)
                return false;

            // Ideally, we'd reuse the bitmaps instead of allocating them every time.  
            //  But maybe that wouldn't actually save us all that much time...  testing needed.
            //  Also, can we do this with fewer than 3 bitmaps???
            var bitmap1:BitmapData = createBitmapData(intersectionRect);  
            var bitmap2:BitmapData = createBitmapData(intersectionRect);
            TestBitmapData = createBitmapData(intersectionRect);  

            drawBitmapData(object1, bitmap1, intersectionRect);
            drawBitmapData(object2, bitmap2, intersectionRect);

            // Move the intersection rectangle back to the origin so it is in bitmap local space     
            intersectionRect.x = 0;
            intersectionRect.y = 0;
            var origin:Point = new Point(0,0);
            
            //  Copy both bitmaps into the Testing bitmap.  Use bitmap2 as an additional alpha mask.
            //  The resulting bitmap is opaque only where BOTH bitmaps have opaque pixels. 
            TestBitmapData.copyPixels(bitmap1, intersectionRect, origin, bitmap2, origin, true);    
            
            //  Draw a rectangle around the pixels where the alpha channel is NOT zero
            //    0xff000000 masks out all data except alpha values
            //    0x00000000 is a color that will match all pixels with zero alpha
            //    false tells the function to search for pixels NOT matching the given color
            var actualIntersectionArea:Rectangle = TestBitmapData.getColorBoundsRect(0xff000000, 0x00000000, false);  
            if (actualIntersectionArea.width > 0 && actualIntersectionArea.height > 0)
                return true;
            else
                return false;
        } 
        
        // Uses only width and height of extents
        //  Clear the bitmap
        //  Make sure the bitmap is big enough,
        //  But not too big
        protected static function createBitmapData(extents:Rectangle):BitmapData
        {
            // Ideally, we'd reuse the bitmap instead of allocating it every time.  But maybe that wouldn't actually save us all that much time.
            var data:BitmapData = new BitmapData(1+extents.width, 1+extents.height, true, 0);  // adding 1 to the extents to handle fractional pixels 
            return data;   
        }
        
        protected static function drawBitmapData(object:DisplayObject, destination:BitmapData, testRect:Rectangle):void
        {
            var transform_from_root_to_local:Matrix = object.transform.concatenatedMatrix.clone();
            
            // Correct the transform to move the intersection rect to 0,0
            transform_from_root_to_local.translate(-testRect.x, -testRect.y); 
            destination.draw(object, transform_from_root_to_local);
        }
    }
}