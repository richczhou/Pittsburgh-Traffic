import * as THREE from './three/build/three.module.js';
import {OrbitControls} from './three/examples/jsm/controls/OrbitControls.js';

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
let linePositions = new Float32Array(3 * 1305);
let colors = new Float32Array(3 * 1305);
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
    controls.maxDistance = 5000;
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
                'data/map.png',
                function(texture) {
                    const mapGeo = flipY(new THREE.PlaneBufferGeometry());
                    const mapMat = new THREE.MeshBasicMaterial({
                        side: THREE.DoubleSide, 
                        map: texture,
                        transparent: true,
                        opacity: 0.4
                    });
                    let mapMesh = new THREE.Mesh(mapGeo, mapMat);
                    mapMesh.scale.set(700, 700, 700);
                    mapMesh.rotateX(Math.PI);
                    mapMesh.rotateZ(-Math.PI/4);
                    mapMesh.position.set(-100, -150, 0)
                    pitt.add(mapMesh);
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

            // Connecting points
            let linePosIter = 0;  
            let maxConnections = 500;
            
            for (let i = 0; i < 1305; i++) {
                if (linePosIter > 2 * maxConnections) break;
                for (let j = i + 1; j < 1306; j++) {
                    // const dist = Math.abs(particlePositions[i * 3 + 2] - particlePositions[j * 3 + 2]);
                    const dist = Math.sqrt((particlePositions[i * 3] - particlePositions[j * 3]) ** 2 + 
                                    (particlePositions[i * 3 + 1] - particlePositions[j * 3 + 1]) ** 2);
                    if (dist < maxDistance) {
                        // Lat, Long, Traffic, RGB I think?
                        colors[linePosIter] = particlePositions[i * 3 + 2] / 100 - 0.1;
                        linePositions[linePosIter++] = particlePositions[i * 3];
                        
                        colors[linePosIter] = 0;
                        linePositions[linePosIter++] = particlePositions[i * 3 + 1];

                        colors[linePosIter] = 1.2 - particlePositions[i * 3 + 2] / 100;
                        linePositions[linePosIter++] = particlePositions[i * 3 + 2];

                        colors[linePosIter] = 0.95;
                        linePositions[linePosIter++] = particlePositions[j * 3];

                        colors[linePosIter] = 0.95;
                        linePositions[linePosIter++] = particlePositions[j * 3 + 1];

                        colors[linePosIter] = 0.95;
                        linePositions[linePosIter++] = particlePositions[j * 3 + 2];
                        
                        // i = j;
                        break;
                    }
                    // console.log(linePosIter)
                }
            }

            //console.log(linePositions)

           const lines = new THREE.BufferGeometry();
            lines.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
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

    // TODO but didn't get to lmfao: update line art
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

// Scene setup
init();

window.addEventListener('resize', onWindowResize);