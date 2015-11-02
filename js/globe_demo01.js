startTime = new Date();  

// globals
var camera, scene, renderer, container;
var light, ambientLight, pointLight;

var globeImage;

var globeTexture;
var myDbgMat, myDbgMat2, myDbgMat3;
var RTTs = {};

// normalizing switch -- off for now
var normalize = false;
// var normalize = true;

var normScene, normCamera, normTexture, normTextureMat, normTextureGeo;
var mats, textureMats;
var easeType;

var loopSteps = 50;

var clock = new THREE.Clock();

//
// HELPER FUNCTIONS
//
	
function log(n) { console.log(n); }

function rads(x) { return x*Math.PI/180; }

function numst(s) { return String((s).toFixed(2)); }

function setMatUniform(name, value) {
	for (mat in mats) {
		mats[mat].uniforms[name].value = value;
	}
}




//
// START THE MACHINE
//

function init() {
container = document.getElementById( 'globecontainer' );

// --- WebGl renderer

try {
    renderer = new THREE.WebGLRenderer( { alpha: true, 'antialias':false } );
    renderer.setSize( container.scrollWidth, container.scrollHeight );
			renderer.setClearColor(0xffffff);
			renderer.autoClear = false;
    container.appendChild( renderer.domElement );
}
catch (e) {
    alert(e);
}
	
	
	//
	// MASTER SCENE SETUP
	//
	
scene = new THREE.Scene();

    
// --- Camera def

var fov = 15; // camera field-of-view in degrees
var width = renderer.domElement.width;
var height = renderer.domElement.height;
var aspect = width / height; // view aspect ratio
camera = new THREE.PerspectiveCamera( fov, aspect, .1, 10000 );
scene.add(camera);
camera.position.z = -900;
camera.position.y = 400;
camera.updateMatrix();
camera.lookAt(scene.position);
camera.rotateZ(.3);
	// adjust container size to window, then
	// fit renderer and camera to container
	// container.style.marginLeft = container.offsetWidth / 2 * -1 + "px";
	// globeResize();	

// --- Light def
    
ambientLight = new THREE.AmbientLight( 0x000000 );
scene.add( ambientLight );

pointLight = new THREE.PointLight( 0xbbbbbb );
	
pointLight.position.set(0, 200, -300);


// MATERIALS
	
var ambient = 0xffffff, diffuse = 0xffffff, specular = 1, shininess = 10.0, scale = 100;

var shader = THREE.ShaderLib[ "normalmap" ];
uniforms = THREE.UniformsUtils.clone( shader.uniforms );

flatNormalTex = THREE.ImageUtils.loadTexture( './img/flat.png', new THREE.UVMapping(), function () { render(); });
uniforms[ "tNormal" ] = { type: 't', value: flatNormalTex };
	
uniforms[ "diffuse" ].value.setHex( diffuse );
uniforms[ "specular" ].value = new THREE.Color().setRGB(specular, specular, specular);
uniforms[ "ambient" ].value.setHex( ambient );
uniforms[ "shininess" ].value = shininess;

uniforms[ "tNormal" ] = { type: 't', value: flatNormalTex };
uniforms[ "tDisplacement" ] = { type: 't', value: globeTexture.texture2 };

uniforms[ "uPointLightPos"] =   { type: "v3", value: pointLight.position },
uniforms[ "uPointLightColor" ] = {type: "c", value: new THREE.Color( pointLight.color )};
uniforms[ "uAmbientLightColor" ] = {type: "c", value: new THREE.Color( ambientLight.color )};

uniforms[ "matrightBottom" ] = { type: 'v2', value: new THREE.Vector2( 180.0, -90.0 ) };
uniforms[ "matleftTop" ] = { type: 'v2', value: new THREE.Vector2( -180.0, 90.0 ) };
uniforms[ "sphereRadius" ] = { type: 'f', value: 100.0 };
uniforms[ "mixAmount" ] = { type: 'f', value: 1.0 };

uniforms[ "diffuse" ].value.convertGammaToLinear();
uniforms[ "specular" ].value.convertGammaToLinear();
uniforms[ "ambient" ].value.convertGammaToLinear();

uniforms[ "enableDisplacement" ] = { type: 'i', value: 1 };
uniforms[ "uDisplacementScale" ] = { type: 'f', value: 100 };
uniforms[ "uDisplacementPostScale" ] = {type: 'f', value: 50 };

uniforms[ "bumpScale" ] = { type: "f", value: 57.0 };
uniforms[ "opacity" ] = { type: "f", value: 1.0 };
uniforms[ "uNormalOffset" ] = { type: "v2", value: new THREE.Vector2( 1.0, 1.0 ) };

material = new THREE.ShaderMaterial( {
    uniforms: uniforms,
    vertexShader: vs_main,
    fragmentShader: fs_main,
} );
	
globeTexture.textureMat2.uniforms.u_erode.value = .006;
globeTexture.textureMat2.uniforms.u_dilate.value = .005;
globeTexture.textureMat.uniforms.u_erode.value = .006;
globeTexture.textureMat.uniforms.u_dilate.value = .005;


textureMats = [globeTexture.textureMat, globeTexture.textureMat2];


// GEOMETRY
	
globeGeo = new THREE.PlaneGeometry(10, 10, 257, 129);
globeGeo.computeTangents();
globeMesh = new THREE.Mesh( globeGeo, material);
	globeMesh.frustumCulled = false;


scene.add(globeMesh);

easeType = TWEEN.Easing.Quartic.InOut;

// calculate all textures
for (x in RTTs) prepTextures(RTTs[x]);
	startLoop();
	endTime = new Date();
	console.log("Load time:", (endTime - startTime) / 1000);
	render();
}

function setMatUniform(name, value) {
	material.uniforms[name].value = value;
}


function setTextureMatUniform(name, value) {
	for (mat in textureMats) {
		textureMats[mat].uniforms[name].value = value;
	}
}


function tweakRTTs() {
	// stopLoop();
	prepTextures(RTTs["globe"]);
	// startLoop();
}


function prepTextures(myRTT) {
	// log(myRTT);
	// the results differ wildly depending on whether erode or dilate runs first -
	// could interleave them but with current setup that would involve
	// recompiling the materials every frame.
	// todo: make four FBOs with dedicated shader assignments
	
	// firstShader = fs_dilate, secondShader = fs_erode;
	firstShader = fs_erode, secondShader = fs_dilate; // this feels better - science!
	
	// set first shader
	myRTT.textureMat.fragmentShader = firstShader;
	myRTT.textureMat.needsUpdate = true;

	myRTT.textureMat2.fragmentShader = firstShader;
	myRTT.textureMat2.needsUpdate = true;
	
	// initialize first RTT FBO's colorMap with the source image
	myRTT.textureMat.uniforms.colorMap.value = myRTT.image;
	
	// render first FBO with erode shader
	renderer.render( myRTT.scene, myRTT.camera, myRTT.texture, false );
				
	// then switch first FBO's colorMap to second FBO
	myRTT.textureMat.uniforms.colorMap.value = myRTT.texture2;
	
	// while ( myRTT.textureMat.uniforms.u_unchanged == 0.0 ) {
	// would be nice to have some kind of switch that turned the loop off
	// when there was no difference detected between the two FBOs.
	// I suppose I'd need a third shader to do a diff... 
	for (x=0;x<loopSteps;x++) {
		calculate(myRTT);
	}
	
	// switch shaders
	myRTT.textureMat.fragmentShader = secondShader;
	myRTT.textureMat.needsUpdate = true;

	myRTT.textureMat2.fragmentShader = secondShader;
	myRTT.textureMat2.needsUpdate = true;


	for (x=0;x<loopSteps;x++) {
		calculate(myRTT);
	}
	
	if (normalize) {		
		//
		// find maximum value in texture
		//
		
		myRTT.textureMat.fragmentShader = fs_maximum;
		myRTT.textureMat.needsUpdate = true;

		// adjust normal texture size to match RTT texture size, if needed
		if (normTexture.height != myRTT.texture.height || normTexture.width != myRTT.texture.width ) {
			adjustNormScene(myRTT.texture.width, myRTT.texture.height);
		}

		// then set normTextureMat's input map to first FBO
		normTextureMat.uniforms.colorMap.value = myRTT.texture;
		
		// set FBO's input map to normmat
		myRTT.textureMat.uniforms.colorMap.value = normTexture;

		// what's the furthest we might have to look?
		limit = Math.max(myRTT.texture.width, myRTT.texture.height);
		divisor = 1;

		while ((limit / divisor) > .5 ) {
			divisor *= 2;
			myRTT.textureMat.uniforms.u_divisor.value = divisor;
			renderer.render( myRTT.scene, myRTT.camera, myRTT.texture, true );

			divisor *= 2;
			normTextureMat.uniforms.u_divisor.value = divisor;
			renderer.render( normScene, normCamera, normTexture, true );
		}
		// change FBO's shader to final output shader
		myRTT.textureMat.fragmentShader = fs_rtt;
		myRTT.textureMat.needsUpdate = true;

		// set FBO's input maps
		myRTT.textureMat.uniforms.colorMap.value = myRTT.texture2;
		myRTT.textureMat.uniforms.valueMap.value = normTexture;

		renderer.render( myRTT.scene, myRTT.camera, myRTT.texture, true );
		myRTT.textureMat.uniforms.colorMap.value = myRTT.texture2;

		renderer.render( myRTT.scene2, myRTT.camera2, myRTT.texture2, true );
		renderer.render(scene, camera);
	}
		render();

}

function calculate(myRTT) {
	// render second FBO, based on first FBO
	renderer.render( myRTT.scene2, myRTT.camera2, myRTT.texture2, false );
	// render first FBO, based on second FBO
	renderer.render( myRTT.scene, myRTT.camera, myRTT.texture, false );
}

var requestId;

function loop() {
	globeMesh.rotateY(globeRotation);
	render();
	requestId = requestAnimationFrame( loop );
}

function startLoop() {
		if (!requestId) {
			 loop();
		}
}

function stopLoop() {
		if (requestId) {
			 cancelAnimationFrame(requestId);
			 requestId = undefined;
		}
}

function render() {
    renderer.clear();
    renderer.render(scene, camera);
}



window.requestAnimFrame = (function(){
return  window.requestAnimationFrame       ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame    ||
        window.oRequestAnimationFrame      ||
        window.msRequestAnimationFrame     ||
        function( callback ){
          window.setTimeout(callback, 1000 / 60);
        };
})();


globeRotation = .005;


//
// onload
//

window.onload = function() {

	// switch images based on window width
	large = $(window).width() < 1200 ? false : true;
	log("large: "+large);
	// load dem textures first thing
	globeImage = THREE.ImageUtils.loadTexture(
		large ? './img/Srtm.2k_norm.jpg' : './img/Srtm.1k_norm.jpg',
		new THREE.UVMapping(),
		// callback function
		function() {
			globeTexture = prepRTT(globeImage, vs, fs_dilate);
			addRTT("globe", globeTexture);
		}
	);

}									


	


// create custom RTT scenes for a texture
function addRTT(name, texture) {
	RTTs[name] = texture; // register texture so it can be referenced by name

	if (Object.keys(RTTs).length == 1) {

		if (normalize) {
			// setup normalizing scene
			normScene = new THREE.Scene();
					
			// create buffer - initialize with size 1 - will be adjusted by adjustNormScene()
			normTexture = new THREE.WebGLRenderTarget( 1, 1 );		

			// custom RTT material
			normUniforms = {
				colorMap: { type: "t", value: texture.image },
				u_divisor: { type: "f", value: 1.0 },
				u_textureSize: { type: "v2", value: new THREE.Vector2( 1, 1 ) },
			};
			normTextureMat = new THREE.ShaderMaterial({
				uniforms: normUniforms,
				vertexShader: vs,
				fragmentShader: fs_maximum
			});		
	
			// Setup render-to-texture scene
			normCamera = new THREE.OrthographicCamera( 1 / - 2, 1 / 2, 1 / 2, 1 / - 2, 1, 10000 );

			normTextureGeo = new THREE.PlaneGeometry( 1, 1 );
			normTextureMesh = new THREE.Mesh( normTextureGeo, myTextureMat );
			normScene.add( normTextureMesh );
		}

		init();

	}
}
	
function adjustNormScene(width, height) {
		// recreate buffer
		normTexture = new THREE.WebGLRenderTarget( width, height, renderTargetParams );	
		// update debug plane's material
		myDbgMat3.map = normTexture;
		// resize texture to match image size
		normTextureMat.uniforms.u_textureSize.value = new THREE.Vector2( width, height );
		normTextureMat.needsUpdate = true;
		// recreate rtt scene
		normScene.remove( normTextureMesh );
		normTextureGeo = new THREE.PlaneGeometry( width, height );
		normTextureMesh = new THREE.Mesh( normTextureGeo, normTextureMat );
		normTextureMesh.position.z = -100;
		normScene.add( normTextureMesh );
		normCamera = new THREE.OrthographicCamera( width / - 2, width / 2, height / 2, height / - 2, 1, 10000 );
}
	

var vs, fs_erode, fs_dilate, fs_maximum, fs_rtt, vs_main, fs_main;

SHADER_LOADER.load(
    function (data)
    {
        vs = data.vs_rt.vertex;
        fs_erode = data.fs_erode.fragment;
        fs_dilate = data.fs_dilate.fragment;
					if (normalize) fs_maximum = data.fs_maximum.fragment;
        fs_rtt = data.fs_rtt.fragment;
					
        vs_main = data.vs_main.vertex;
					fs_main = data.fs_main.fragment;

    }
);
	
