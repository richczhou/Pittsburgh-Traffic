import * as THREE from './three/build/three.module.js';
import {OrbitControls} from './three/examples/jsm/controls/OrbitControls.js';
import {vertexShader, fragmentShader} from './shaders.js';

// To keep ESLint happy
/* global THREE */

let container;
let camera;
let renderer;
let controls;
let scene;
let traffic;
let particles;
let particlePositions = new Float32Array(3 * 1305);
// let linePositions = new Float32Array(3 * 1305);
// let colors = new Float32Array(3 * 1305);
let linePositions = []
let colors = [];
let pointCloud;
let linesMesh;
const particleCount = 5000;
const maxDistance = 250;
const minTraffic = 30;

function init() {
    // Reference to container element that holds the entire scene
    container = document.querySelector('#scene-container');

    scene = new THREE.Scene();
    // scene.background = new THREE.Color('skyblue');

    // Create Camera
    const fov = 35;
    const aspectRatio = container.clientWidth / container.clientHeight;
    const nearPlane = 0.1;
    const farPlane = 10000;

    camera = new THREE.PerspectiveCamera(fov, aspectRatio, nearPlane, farPlane);
    camera.position.set(0, 1400, 0);

    // Create Controls
    // container param allows orbit only in the container, not the whole doc
    controls = new OrbitControls(camera, container);
    controls.minDistance = 500;
    controls.maxDistance = 2000;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI/2;

    const pitt = new THREE.Group();
    pitt.position.set(100, -100, -25);
    pitt.rotateX(-Math.PI/2);
    pitt.rotateZ(-Math.PI/4)
    scene.add(pitt);

    const scaleFactor = 1200;
    const lonAvg = -79.981731;
    const latAvg = 40.457227;

    let loader = new THREE.FileLoader();
    loader.load(
        'data/counts.csv',

        // ON LOAD CALLBACK
        function (data) {
            traffic = data.split('\n');
            for(let row in traffic) {
                traffic[row] = traffic[row].split(',');
                for(let entry in traffic[row]) {
                    // Latitude
                    if (entry == 2) {
                        traffic[row][entry] = (+traffic[row][entry] - latAvg) * scaleFactor;
                    }
                    // Longitutde
                    else if (entry == 1) {
                        traffic[row][entry] = (+traffic[row][entry] - lonAvg) * scaleFactor;
                    }
                    // Replacing label with traffic count lol
                    else if (entry == 0) {
                        traffic[row][entry] = 0;
                        for(let i = 3; i < 27; i++)
                            if(+traffic[row][i] > 0)    
                                traffic[row][entry] += +traffic[row][i];
                    }
                }
            }
            // console.log(traffic);

            for(let r in traffic) {
                // Lat, Long, Counts
                particlePositions[r * 3] = -traffic[r][2];
                particlePositions[r * 3 + 1] = -traffic[r][1];
                particlePositions[r * 3 + 2] = traffic[r][0] / 50;
                // particlePositions[r * 3 + 2] = 0;
            }

            // Adding map plane
            const texLoader = new THREE.TextureLoader();
            texLoader.load(
                'data/heightmap.png',
                function(texture) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    // Giving map plane a bumpmap
                    const heightMap = new THREE.TextureLoader().load(
                        'data/heightmap.png',
                        function(bumptexture) {
                            bumptexture.wrapS = THREE.RepeatWrapping;
                            bumptexture.wrapT = THREE.RepeatWrapping;
                            let bumpScale = 100;
                            const mapGeo = flipY(new THREE.PlaneBufferGeometry(700, 700, 50, 50));
                            const mapMat = new THREE.ShaderMaterial({
                                uniforms: {
                                    bumpMap:	{ type: "t", value: bumptexture },
                                    bumpScale:	{ type: "f", value: bumpScale },
                                    uvTexture:	{ type: "t", value: texture },
                                },
                                vertexShader: vertexShader,
                                fragmentShader: fragmentShader,
                                side: THREE.DoubleSide, 
                                transparent: true
                            });
                            let mapMesh = new THREE.Mesh(mapGeo, mapMat);
                            mapMesh.rotateX(Math.PI);
                            mapMesh.rotateZ(-Math.PI/4);
                            mapMesh.position.set(-150, -150, -50)
                            pitt.add(mapMesh);
                        }
                    )
                }
            )
            
            // Creating the point cloud
            const pointMaterial = new THREE.PointsMaterial( {
                color: 0xFFFFFF,
                size: 4,
                blending: THREE.AdditiveBlending,
                sizeAttenuation: true
            } );

            // console.log(particlePositions)

            particles = new THREE.BufferGeometry();
            // particles.setDrawRange(0, particleCount);
            particles.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage));
            pointCloud = new THREE.Points(particles, pointMaterial);
            pitt.add(pointCloud);

            // Creating the line visuals
            const lineMaterial = new THREE.LineBasicMaterial({
                vertexColors: true,
                color: 0xFFFFFF,
                blending: THREE.AdditiveBlending
            });

            for (let i = 0; i < 2; i++) {
                let buff = getPath();
                linePositions.push(...buff.position);
                colors.push(...buff.color);
            }

            const lines = new THREE.BufferGeometry();
            lines.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
            lines.setAttribute( 'color', new THREE.Float32BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
            lines.computeBoundingSphere();
            // lines.setDrawRange( 0, numConnected * 2 );

            linesMesh = new THREE.LineSegments(lines, lineMaterial);
            pitt.add(linesMesh);


            // Creating the renderer
            renderer = new THREE.WebGLRenderer({
                antialias: true
            });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            // Applying gamma correction for colors
            renderer.gammaFactor = 2.2;
            renderer.outputEncoding = THREE.sRGBEncoding;

            // Appending WebGLRenderer's canvas element to HTML
            container.appendChild(renderer.domElement);

            renderer.setAnimationLoop(() => {
                update();
                render();
            });
        }  // CALLBACK END
    );
}

function update() {
    controls.update();

    // TODO update line art
    
	// linesMesh.geometry.attributes.position.needsUpdate = true;
}

function render() {
    renderer.render(scene, camera);
}

function onWindowResize() {
    // Resizing camera to new window frame
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();

    // Resizing renderer's canvas to fit
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function flipY( geometry ) {
    const uv = geometry.attributes.uv;
    for ( let i = 0; i < uv.count; i ++ ) {
        uv.setY( i, 1 - uv.getY( i ) );
    }
    return geometry;
}

function getPath() {
    let bufferIndex = [];
    let bufferColor = [];
    // randomize how many points are in each generated path
    let pointsInPath = Math.floor(Math.random() * 10 + 3);

    // create a path between them in a roughly straight line
    let point1 = Math.floor(Math.random() * 1305);
    let point2 = Math.floor(Math.random() * 1305);
    while (point1 == point2 &&
           Math.sqrt((particlePositions[point1 * 3] - particlePositions[point2 * 3]) ** 2 + 
                     (particlePositions[point1 * 3 + 1] - particlePositions[point2 * 3 + 1]) ** 2) < 1000) {point2 = Math.floor(Math.random() * 1305)};
    let pointVector = new THREE.Vector2(particlePositions[point2 * 3] - particlePositions[point1 * 3],
                                        particlePositions[point2 * 3 + 1] - particlePositions[point1 * 3 + 1]).normalize();

    let pathPoints = []
    while (pathPoints.length < pointsInPath) {
    // for (let i = 0; i < 1300; i++) {
        let testPoint = Math.floor(Math.random() * 1305);
        // check if its between both points
        if (true || (particlePositions[point1*3] < particlePositions[testPoint*3] && particlePositions[testPoint*3] < particlePositions[point2*3] &&
             particlePositions[point1*3 + 1] < particlePositions[testPoint*3 + 1] && particlePositions[testPoint*3 + 1] < particlePositions[point2*3 + 1]) || 
            (particlePositions[point2*3] < particlePositions[testPoint*3] && particlePositions[testPoint*3] < particlePositions[point1*3] &&
             particlePositions[point2*3 + 1] < particlePositions[testPoint*3 + 1] && particlePositions[testPoint*3 + 1] < particlePositions[point1*3 + 1])) {
            // check if they're pointing the same direction
            if (Math.abs(new THREE.Vector2(particlePositions[point2 * 3] - particlePositions[testPoint * 3],
                            particlePositions[point2 * 3 + 1] - particlePositions[testPoint * 3 + 1])
                            .normalize()
                            .dot(pointVector)) > 0.9 &&
                Math.abs(new THREE.Vector2(particlePositions[point1 * 3] - particlePositions[testPoint * 3],
                            particlePositions[point1 * 3 + 1] - particlePositions[testPoint * 3 + 1])
                            .normalize()
                            .dot(pointVector)) > 0.9) {
                // add to array !
                pathPoints.push(testPoint);
            }
        }
    }
    if (pathPoints.length) pathPoints.push(point1, point2);

    // rearrange path in order of distance
    pathPoints.sort((a,b) => {
        let d1 = Math.sqrt((1000 - particlePositions[a * 3]) ** 2 + 
                  (1000 - particlePositions[a * 3 + 1]) ** 2);
        let d2 = Math.sqrt((1000 - particlePositions[b * 3]) ** 2 + 
                    (1000 - particlePositions[b * 3 + 1]) ** 2);
        console.log("Distances: " , d1, " ", d2);
        return d1 - d2;
    });

    // update indices of buffer geometry
    for(let j = 1; j < pathPoints.length; j++) {
        bufferIndex.push(particlePositions[pathPoints[j - 1] * 3],
                            particlePositions[pathPoints[j - 1] * 3 + 1],
                            particlePositions[pathPoints[j - 1] * 3 + 2]);
        bufferIndex.push(particlePositions[pathPoints[j] * 3],
                            particlePositions[pathPoints[j] * 3 + 1],
                            particlePositions[pathPoints[j] * 3 + 2]);
        bufferColor.push(particlePositions[j * 3 + 2] / 100 - 0.1,
                         0,
                         1.2 - particlePositions[j * 3 + 2] / 100);
        bufferColor.push(0.95, 0.95, 0.95)
    }
    console.log(bufferIndex)
    console.log(bufferColor)
    return {
        position: bufferIndex,
        color: bufferColor
    }
}

// Scene setup
init();

window.addEventListener('resize', onWindowResize);