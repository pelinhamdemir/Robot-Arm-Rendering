//----------------------------------------------------------------------------
// State Variable Setup 
//----------------------------------------------------------------------------

// This variable will store the WebGL rendering context
var gl;

// Speed
var rotationSpeed = 90.0; // Speed of rotation in degrees per second
//Collect shape information into neat package
var shapes = {
   wireCube: {points:[], colors:[], start:0, size:0, type: 0},
   solidCube: {points:[], colors:[], start:0, size:0, type: 0},
   axes: {points:[], colors:[], start:0, size:0, type: 0},
};

//Variables for Transformation Matrices
var mv = new mat4();
var p  = new mat4();
var mvLoc, projLoc;

// Model state variables
var shoulderX = 0, shoulderY = 0, shoulder = 0;
var elbow = 0;
var fingerSpreadX = 0, fingerSpreadY = 0, fingerSpread = 0;
var fingerAngles = [0, 0, 0, 0]; // Angles for 3 fingers and thumb
var isAnimating = false; // Prevent multiple animations from overlapping
var isPerspective = true;
var isPToggled = false; // To debounce the toggle
var isWireframe = false; // Default to solid cube
//----------------------------------------------------------------------------
// Define Shape Data 
//----------------------------------------------------------------------------

//Some colours
var red = 		   	vec4(1.0, 0.0, 0.0, 1.0);
var green = 	   	vec4(0.0, 1.0, 0.0, 1.0);
var blue = 		   	vec4(0.0, 0.0, 1.0, 1.0);
var lightred =		vec4(1.0, 0.5, 0.5, 1.0);
var lightgreen =	vec4(0.5, 1.0, 0.5, 1.0);
var lightblue =   	vec4(0.5, 0.5, 1.0, 1.0);
var white = 	   	vec4(1.0, 1.0, 1.0, 1.0);


//Generate Axis Data: use LINES to draw. Three axes in red, green and blue
shapes.axes.points = 
[ 
	vec4(  2.0,  0.0,  0.0, 1.0), //x axis, will be green
	vec4( -2.0,  0.0,  0.0, 1.0),
	vec4(  0.0,  2.0,  0.0, 1.0), //y axis, will be red
	vec4(  0.0, -2.0,  0.0, 1.0),
	vec4(  0.0,  0.0,  2.0, 1.0), //z axis, will be blue
	vec4(  0.0,  0.0, -2.0, 1.0)
];

shapes.axes.colors = 
[
	green,green,
	red,  red,
	blue, blue
];


//Define points for a unit cube
var cubeVerts = [
	vec4( 0.5,  0.5,  0.5, 1), //0
	vec4( 0.5,  0.5, -0.5, 1), //1
	vec4( 0.5, -0.5,  0.5, 1), //2
	vec4( 0.5, -0.5, -0.5, 1), //3
	vec4(-0.5,  0.5,  0.5, 1), //4
	vec4(-0.5,  0.5, -0.5, 1), //5
	vec4(-0.5, -0.5,  0.5, 1), //6
	vec4(-0.5, -0.5, -0.5, 1), //7
];

//Look up patterns from cubeVerts for different primitive types
//Wire Cube - draw with LINE_STRIP
var wireCubeLookups = [
	0,4,6,2,0, //front
	1,0,2,3,1, //right
	5,1,3,7,5, //back
	4,5,7,6,4, //right
	4,0,1,5,4, //top
	6,7,3,2,6, //bottom
];

//Solid Cube - draw with TRIANGLES, 2 triangles per face
var solidCubeLookups = [
	0,4,6,   0,6,2, //front
	1,0,2,   1,2,3, //right
	5,1,3,   5,3,7,//back
	4,5,7,   4,7,6,//left
	4,0,1,   4,1,5,//top
	6,7,3,   6,3,2,//bottom
];

//Expand Wire Cube data: this wire cube will be white...
for (var i =0; i < wireCubeLookups.length; i++)
{
   shapes.wireCube.points.push(cubeVerts[wireCubeLookups[i]]);
   shapes.wireCube.colors.push(white);
}

//Expand Solid Cube data: each face will be a different color so you can see
//    the 3D shape better without lighting.
var colorNum = 0;
var colorList = [lightblue, lightgreen, lightred, blue, red, green];
for (var i = 0; i < solidCubeLookups.length; i++)
{
   shapes.solidCube.points.push(cubeVerts[solidCubeLookups[i]]);
   shapes.solidCube.colors.push(colorList[colorNum]);
   if (i % 6 == 5) colorNum++; //Switch color for every face. 6 vertices/face
}

//load data into points and colors arrays - runs once as page loads.
var points = [];
var colors = [];

//Convenience function:
//  - adds shape data to points and colors arrays
//  - adds primitive type to a shape
function loadShape(myShape, type)
{
   myShape.start = points.length;
   points = points.concat(myShape.points);
   colors = colors.concat(myShape.colors);
   myShape.size = points.length - myShape.start;
   myShape.type = type;
}

//----------------------------------------------------------------------------
// Initialization Event Function
//----------------------------------------------------------------------------

window.onload = function init() {
   // Set up a WebGL Rendering Context in an HTML5 Canvas
   var canvas = document.getElementById("gl-canvas");
   gl = canvas.getContext("webgl2");
   if (!gl) {
      canvas.parentNode.innerHTML("Cannot get WebGL2 Rendering Context");
   }

   //  Configure WebGL
   //  eg. - set a clear color
   //      - turn on depth testing
   gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
   gl.enable(gl.DEPTH_TEST);
   gl.clearColor(0.0, 0.0, 0.0, 1.0);
   gl.enable(gl.CULL_FACE);

   //  Load shaders and initialize attribute buffers
   var program = initShaders(gl, "shader.vert", "shader.frag");
   gl.useProgram(program);

   // Set up data to draw
   // Mostly done globally in this program...
   loadShape(shapes.wireCube, gl.LINE_STRIP);
   loadShape(shapes.solidCube, gl.TRIANGLES);
   loadShape(shapes.axes, gl.LINES);


   // Load the data into GPU data buffers and
   // Associate shader attributes with corresponding data buffers
   //*Vertices*
   var vertexBuffer = gl.createBuffer();
   gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
   gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
   program.vPosition = gl.getAttribLocation(program, "vPosition");
   gl.vertexAttribPointer(program.vPosition, 4, gl.FLOAT, gl.FALSE, 0, 0);
   gl.enableVertexAttribArray(program.vPosition);

   //*Colors*
   var colorBuffer = gl.createBuffer();
   gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
   gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
   program.vColor = gl.getAttribLocation(program, "vColor");
   gl.vertexAttribPointer(program.vColor, 4, gl.FLOAT, gl.FALSE, 0, 0);
   gl.enableVertexAttribArray(program.vColor);

   // Get addresses of shader uniforms
   projLoc = gl.getUniformLocation(program, "p");
   mvLoc = gl.getUniformLocation(program, "mv");

   //Set up projection matrix
   var aspect = canvas.clientWidth/canvas.clientHeight;
   //p = ortho(-3.4*aspect, 3.4*aspect, -3.4, 3.4, 1.0, 20.0);
   p = perspective(40.0, aspect, 0.1, 100.0);
  

   gl.uniformMatrix4fv(projLoc, gl.FALSE, flatten(transpose(p)));

   //Set initial view
   var eye = vec3(0.0, 1.0, 10.0);
   var at = vec3(0.0, 0.0, 0.0);
   var up = vec3(0.0, 1.0, 0.0);

   mv = lookAt(eye, at, up);

   //Animate - draw continuously
   requestAnimationFrame(animate);
};

//----------------------------------------------------------------------------
// Animation and Rendering Event Functions
//----------------------------------------------------------------------------

//animate()
//updates and displays the model based on elapsed time
//sets up another animation event as soon as possible
var prevTime = 0;
function animate()
{
    requestAnimationFrame(animate);
    
    //Do time corrected animation
    var curTime = new Date().getTime();
    if (prevTime != 0)
    {
       //Calculate elapsed time in seconds
       var timePassed = (curTime - prevTime)/1000.0;
       //Update any active animations 
       handleKeys(timePassed);
    }
    prevTime = curTime;
    
    //Draw
    render();
}

function render() {
   gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

   var armShape = isWireframe ? shapes.wireCube : shapes.solidCube; // Choose cube type
   var matStack = [];

   // Save view transform
   matStack.push(mv);

   // Shoulder Joint
   mv = mult(mv, translate(-2.0, 0.0, 0.0));
   mv = mult(mv, rotate(shoulder, vec3(0, 0, 1))); // Shoulder Z rotation
   mv = mult(mv, rotate(shoulderX, vec3(1, 0, 0))); // Shoulder X rotation
   mv = mult(mv, rotate(shoulderY, vec3(0, 1, 0))); // Shoulder Y rotation
   mv = mult(mv, translate(1.0, 0.0, 0.0));

   // Upper Arm
   matStack.push(mv);
   mv = mult(mv, scale(2.0, 0.4, 1.0)); // Scale for upper arm
   gl.uniformMatrix4fv(mvLoc, gl.FALSE, flatten(transpose(mv)));
   gl.drawArrays(armShape.type, armShape.start, armShape.size);
   mv = matStack.pop();

   // Elbow Joint
   mv = mult(mv, translate(1.0, 0.0, 0.0));
   mv = mult(mv, rotate(elbow, vec3(0, 0, 1))); // Elbow rotation
   mv = mult(mv, translate(1.0, 0.0, 0.0));

   // Forearm
   matStack.push(mv);
   mv = mult(mv, scale(2.0, 0.4, 1.0)); // Scale for forearm
   gl.uniformMatrix4fv(mvLoc, gl.FALSE, flatten(transpose(mv)));
   gl.drawArrays(armShape.type, armShape.start, armShape.size);
   mv = matStack.pop();

   // Render Fingers
   renderFingers(mv, armShape, fingerAngles);

   // Restore the initial model-view matrix
   mv = matStack.pop();
}
function renderFingers(mv, armShape, angles) {
   var matStack = [];
   // Render 3 Fingers
   for (let i = 0; i < 3; i++) {
       matStack.push(mv);
       let zOffset = i === 1 ? 0.0 : (i === 0 ? 0.15 : -0.15); // Spread fingers horizontally
       mv = mult(mv, translate(1.1, 0.25, zOffset)); // Translate to wrist position
       mv = mult(mv, rotate(angles[i], vec3(0, 0, -1))); // Rotate finger based on its angle
       mv = mult(mv, rotate(fingerSpread*30, vec3(0, 0, -1))); // Rotate finger based on its angle
       mv = mult(mv, rotate(fingerSpreadX*30, vec3(-1, 0, 0))); // Rotate finger based on its angle
       mv = mult(mv, rotate(fingerSpreadY*30, vec3(0, -1, 0))); // Rotate finger based on its angle

       // Render first segment of the finger
       matStack.push(mv);
       mv = mult(mv, rotate(-45, vec3(0, 0, 1))); // Initial rotation
       mv = mult(mv, translate(0.1, 0.0, 0.0)); // Translate to center of the first segment
       mv = mult(mv, scale(0.4, 0.1, 0.1)); // Scale for the first segment
       gl.uniformMatrix4fv(mvLoc, gl.FALSE, flatten(transpose(mv)));
       gl.drawArrays(armShape.type, armShape.start, armShape.size);
       mv = matStack.pop();

       // Render second segment of the finger
       mv = mult(mv, translate(0.2, 0.2, 0.0)); // Translate to the end of the first segment
       mv = mult(mv, translate(0.2, 0.0, 0.0)); // Translate to center of the second segment
       mv = mult(mv, scale(0.4, 0.1, 0.1)); // Scale for the second segment
       gl.uniformMatrix4fv(mvLoc, gl.FALSE, flatten(transpose(mv)));
       gl.drawArrays(armShape.type, armShape.start, armShape.size);
       mv = matStack.pop();
   }

   // Render Thumb
   matStack.push(mv);
   mv = mult(mv, translate(1.1, -0.25, 0.0)); // Position the thumb
   mv = mult(mv, rotate(angles[3], vec3(0, 0, 1))); // Rotate thumb based on its angle
   mv = mult(mv, rotate(fingerSpread*30, vec3(0, 0, 1))); // Rotate finger based on its angle


   // Render thumb segments
   matStack.push(mv);
   mv = mult(mv, rotate(45, vec3(0, 0, 1))); // Initial rotation for the thumb
   mv = mult(mv, translate(0.2, 0.0, 0.0)); // Translate to center of the first segment
   mv = mult(mv, scale(0.4, 0.1, 0.1)); // Scale for the first segment
   gl.uniformMatrix4fv(mvLoc, gl.FALSE, flatten(transpose(mv)));
   gl.drawArrays(armShape.type, armShape.start, armShape.size);
   mv = matStack.pop();

   mv = mult(mv, translate(0.3, -0.3, 0.0)); // Translate to the end of the first segment
   mv = mult(mv, translate(0.2, 0.0, 0.0)); // Translate to center of the second segment
   mv = mult(mv, scale(0.4, 0.1, 0.1)); // Scale for the second segment
   gl.uniformMatrix4fv(mvLoc, gl.FALSE, flatten(transpose(mv)));
   gl.drawArrays(armShape.type, armShape.start, armShape.size);

   mv = matStack.pop();
}









//----------------------------------------------------------------------------
// Keyboard Event Functions
//----------------------------------------------------------------------------

//This array will hold the pressed or unpressed state of every key
var currentlyPressedKeys = [];

//Store current state of shift key
var shift;

document.onkeydown = function handleKeyDown(event) {
   currentlyPressedKeys[event.keyCode] = true;
   shift = event.shiftKey;

   //Get unshifted key character
   var c = event.keyCode;
   var key = String.fromCharCode(c);

	//Place key down detection code here
}

document.onkeyup = function handleKeyUp(event) {
   currentlyPressedKeys[event.keyCode] = false;
   shift = event.shiftKey;
   
   //Get unshifted key character
   var c = event.keyCode;
   var key = String.fromCharCode(c);

	//Place key up detection code here
}

//isPressed(c)
//Utility function to lookup whether a key is pressed
//Only works with unshifted key symbol
// ie: use "E" not "e"
//     use "5" not "%"
function isPressed(c)
{
   var code = c.charCodeAt(0);
   return currentlyPressedKeys[code];
}


function wait(ms) {
   return new Promise(resolve => setTimeout(resolve, ms));
}
//handleKeys(timePassed)
//Continuously called from animate to cause model updates based on
//any keys currently being held down
function handleKeys(timePassed) 
{
   //Place continuous key actions here - anything that should continue while a key is
   //held

   //Calculate how much to move based on time since last update

//  x/X: to rotate the arm on the X axis so you can see it from different angles
//  y/Y: to rotate the arm on the Y axis so you can see it from different angles
//  a/A: to rotate the fingers on the x-axis with positive direction
//  b/B: to rotate the fingers on the x-axis with negative direction
//  m/M: to rotate the fingers on the y-axis with positive direction
//  n/N: to rotate the fingers on the y-axis with negative direction
//  t/T: toggle between solid and wire cubes
//  p/P: toggle between perspective and ortho projections
//  S/s: Increase movement speed
//  D/d: Decrease movement speed
//  Z/z: Sequential fingers closing right to left
//  G/g: Sequential fingers opening right to left

    // Handle continuous key actions
    var d = rotationSpeed * timePassed; // Use the updated speed    
    // Shoulder Updates (rotation around the X-axis)
   //  if (shift && isPressed("S")) {
   //     if (shoulder < 90) shoulder = (shoulder + d);
   //     else shoulder = 90;
   //  }
   //  if (!shift && isPressed("S")) {
   //     if (shoulder > -90) shoulder = (shoulder - d);
   //     else shoulder = -90;
   //  }
    
    // Elbow Updates (rotation around the Y-axis)
    if (shift && isPressed("E")) {
       if (elbow < 0) elbow = (elbow + d);
       else elbow = 0;
    }
    if (!shift && isPressed("E")) {
       if (elbow > -144) elbow = (elbow - d);
       else elbow = -144;
    }
 
    // Handle rotation of the arm on the X-axis (x/X)
    if (shift &&isPressed("X")) {
       shoulderX += d; // rotate shoulder along X-axis
       if (shoulderX > 90) shoulderX = 90;
    }
    if (!shift && isPressed("X")) {
       shoulderX -= d; // rotate shoulder along X-axis (negative direction)
       if (shoulderX < -90) shoulderX = -90;
    }
 
    // Handle rotation of the arm on the Y-axis (y/Y)
    if (shift && isPressed("Y")) {
      shoulderY += d; // rotate shoulder along Y-axis
       if (shoulderY > 90) shoulderY = 90;
    }
    if (!shift && isPressed("Y")) {
      shoulderY -= d; // rotate shoulder along Y-axis (negative direction)
       if (shoulderY < -144) shoulderY = -144;
    } 
    // Handle finger spread with F/f
    if (shift && isPressed("F")) {
       fingerSpread += 0.02; // increase spread of fingers and thumb
       if (fingerSpread > 1) fingerSpread = 1; // limit max spread
    }
    
    if (!shift &&isPressed("F")) {
       fingerSpread -= 0.02; // decrease spread of fingers and thumb
       if (fingerSpread < -1) fingerSpread = -1; // limit min spread
    }

    //handle finger rotate in x with A/a
     if (isPressed("A")) {
      fingerSpreadX += 0.02; // increase spread of fingers and thumb
      if (fingerSpreadX > 0.5) fingerSpreadX = 0.5; // limit max spread
   }
       //handle finger rotate in x with B/b
   if (isPressed("B")) {
      fingerSpreadX -= 0.02; // decrease spread of fingers and thumb
      if (fingerSpreadX < -0.5) fingerSpreadX = -0.5; // limit min sprea
   }

     //handle finger rotate in y with M/m
     if (isPressed("M")) {
      fingerSpreadY += 0.02; // increase spread of fingers and thumb
      if (fingerSpreadY > 0.5) fingerSpreadY = 0.5; // limit max spread
   }
      //handle finger rotate in y with N/n
   if (isPressed("N")) {
      fingerSpreadY -= 0.02; // decrease spread of fingers and thumb
      if (fingerSpreadY < -0.5) fingerSpreadY = -0.5; // limit min sprea
   }

   if (isPressed("Z")) {
      (async () => {
          for (let i = 0; i < fingerAngles.length; i++) {
              fingerAngles[i] -= d; // Close each finger
              if (fingerAngles[i] < -40) fingerAngles[i] = -40; // Limit closure to -45 degrees
              await wait(500); // Her iterasyondan sonra 0.5 saniye bekle
          }
      })();
  }
  
  // Sequential Fingers Opening (G/g)
  if (isPressed("G")) {
      (async () => {
          for (let i = 0; i < fingerAngles.length; i++) {
              fingerAngles[i] += d; // Open each finger
              if (fingerAngles[i] > 0) fingerAngles[i] = 0; // Limit opening to 0 degrees
              await wait(500); // Her iterasyondan sonra 0.5 saniye bekle
          }
      })();
  }

  if (isPressed("T")) {
   if (!isPToggled) {
       isWireframe = !isWireframe; // Toggle between solid and wireframe
       isPToggled = true;
   }
} else if (isPressed("P")) {
   if (!isPToggled) {
       isPerspective = !isPerspective; // Toggle between perspective and orthographic
       var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
       p = isPerspective
           ? perspective(40.0, aspect, 0.1, 100.0)
           : ortho(-3.4 * aspect, 3.4 * aspect, -3.4, 3.4, 1.0, 20.0);
       gl.uniformMatrix4fv(projLoc, gl.FALSE, flatten(transpose(p)));
       isPToggled = true;
   }
} else {
   isPToggled = false; // Reset debounce when no toggle key is pressed
}

if (isPressed("S")) {
   rotationSpeed += 10.0; // Increase speed by 10 degrees per second
   if (rotationSpeed > 360.0) rotationSpeed = 360.0; // Limit max speed to 360 degrees/second
}

if (isPressed("D")) {
   rotationSpeed -= 10.0; // Decrease speed by 10 degrees per second
   if (rotationSpeed < 10.0) rotationSpeed = 10.0; // Limit min speed to 10 degrees/second
}

}