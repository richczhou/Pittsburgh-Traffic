import * as THREE from './three/build/three.module.js';
import {OrbitControls} from './three/examples/jsm/controls/OrbitControls.js';
import {vertexShader, fragmentShader} from './shaders.js';

// To keep ESLint happy
/* global THREE */

const minPathDistance = 100;
const lineCount = 5;
const pathLength = 15;
let container;
let camera;
let renderer;
let controls;
let clock;
let scene;
let traffic;
let particles;
let particlePositions = new Float32Array(3 * 1305);
let linePositions = new Float32Array((2 * pathLength - 2) * 3 * lineCount);
let colors = new Float32Array((2 * pathLength - 2) * 3 * lineCount);
let bufferIter = 0;
let clockTime;
let pointCloud;
let linesMesh;

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

    clock = new THREE.Clock();
    clockTime = clock.startTime - 5;

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

            for (let i = 0; i < lineCount; i++) {
                let buff = getPath();
                // add path to buffer array
                for(let j = 0; j < (2 * pathLength - 2) * 3; j++) {
                    linePositions[bufferIter] = buff.position[j];
                    colors[bufferIter] = buff.color[j] * 0.05;
                    bufferIter = (bufferIter + 1) % ((2 * pathLength - 2) * 3 * lineCount);
                }
            }

            const lines = new THREE.BufferGeometry();
            lines.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
            lines.setAttribute( 'color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
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

    // Redraw a path every 5 seconds
    if(clock.getElapsedTime() - clockTime > 5) {
        clockTime = clock.getElapsedTime();
        console.log(clockTime)
        
        let buff = getPath();
        // add path to buffer array
        for(let j = 0; j < (2 * pathLength - 2) * 3; j++) {
            linePositions[bufferIter] = buff.position[j];
            colors[bufferIter] = buff.color[j];
            bufferIter = (bufferIter + 1) % ((2 * pathLength - 2) * 3 * lineCount);
        }
        linesMesh.geometry.attributes.position.needsUpdate = true;
        linesMesh.geometry.attributes.color.needsUpdate = true;
    } else {
        // update colors of existing paths
        for(let i = 0; i < (2 * pathLength - 2) * 3 * lineCount; i++) {
            // console.log(colors[i])
            if(colors[i] > .05) colors[i] *= .995;
        }
        linesMesh.geometry.attributes.color.needsUpdate = true;
    }
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

    // create a path between them in a roughly straight line
    let point1 = Math.floor(Math.random() * 1305);
    let point2 = Math.floor(Math.random() * 1305); 
    while ((point1 == point2) ||
           Math.sqrt((particlePositions[point1 * 3] - particlePositions[point2 * 3]) ** 2 + 
                     (particlePositions[point1 * 3 + 1] - particlePositions[point2 * 3 + 1]) ** 2) < minPathDistance) {
        point2 = Math.floor(Math.random() * 1305)
    }; 
    let pointVector = new THREE.Vector2(particlePositions[point2 * 3] - particlePositions[point1 * 3],
                                        particlePositions[point2 * 3 + 1] - particlePositions[point1 * 3 + 1]).normalize();
    
    let pathPoints = [];
    while (pathPoints.length < pathLength) {
    // for (let i = 0; i < 1300; i++) {
        let testPoint = Math.floor(Math.random() * 1305);
        while(pathPoints.includes(testPoint)) testPoint = Math.floor(Math.random() * 1305);  // reroll
        // check if they're pointing the same direction
        if (Math.abs(new THREE.Vector2(particlePositions[point2 * 3] - particlePositions[testPoint * 3],
                        particlePositions[point2 * 3 + 1] - particlePositions[testPoint * 3 + 1])
                        .normalize()
                        .dot(pointVector)) > 0.8 &&
            Math.abs(new THREE.Vector2(particlePositions[point1 * 3] - particlePositions[testPoint * 3],
                        particlePositions[point1 * 3 + 1] - particlePositions[testPoint * 3 + 1])
                        .normalize()
                        .dot(pointVector)) > 0.8) {
            // add to array !
            pathPoints.push(testPoint);
        }
    }
    if (pathPoints.length) pathPoints.push(point1, point2);
    if (pathPoints.length > pathLength) pathPoints = pathPoints.slice(0, pathLength);
    // safety check

    // rearrange path in order of distance (from what point??)
    pathPoints.sort((a,b) => {
        let d1 = Math.sqrt((10 - particlePositions[a * 3]) ** 2 + 
                  (1000 - particlePositions[a * 3 + 1]) ** 2);
        let d2 = Math.sqrt((10 - particlePositions[b * 3]) ** 2 + 
                    (1000 - particlePositions[b * 3 + 1]) ** 2);
        // console.log("Distances: " , d1, " ", d2);
        return d1 - d2;
    });

    // update indices of buffer arrays
    for(let j = 1; j < pathPoints.length; j++) {
        bufferIndex.push(particlePositions[pathPoints[j - 1] * 3],
                            particlePositions[pathPoints[j - 1] * 3 + 1],
                            particlePositions[pathPoints[j - 1] * 3 + 2]);
        bufferIndex.push(particlePositions[pathPoints[j] * 3],
                            particlePositions[pathPoints[j] * 3 + 1],
                            particlePositions[pathPoints[j] * 3 + 2]);
        bufferColor.push(particlePositions[pathPoints[j - 1] * 3 + 2] / 100 - 0.1,
                         0,
                         1.2 - particlePositions[pathPoints[j - 1] * 3 + 2] / 100);
        bufferColor.push(0.95, 0.95, 0.95)
    }

    return {
        position: bufferIndex,
        color: bufferColor
    }
}

// Scene setup
init();

window.addEventListener('resize', onWindowResize);