'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function StarfieldBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const particlesRef = useRef<THREE.Points | null>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const targetRotationRef = useRef({ x: 0, y: 0 });
    const currentRotationRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!canvasRef.current) return;

        console.log('🌟 StarfieldBackground mounting...');

        // Scene setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Camera setup
        const camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.z = 0;
        cameraRef.current = camera;

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            alpha: true,
            antialias: true,
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        rendererRef.current = renderer;

        // Create particles - Optimized for performance
        const POINTS_COUNT = 4000; // Reduced from 30000 to fix lag
        const positions = new Float32Array(POINTS_COUNT * 3);
        const colors = new Float32Array(POINTS_COUNT * 3);
        const sizes = new Float32Array(POINTS_COUNT);

        // Brighter color palette
        const palette = [
            new THREE.Color(0xffffff), // bright white
            new THREE.Color(0xaaddff), // brighter light blue
            new THREE.Color(0x88bbff), // brighter blue
            new THREE.Color(0xccaaff), // brighter purple
            new THREE.Color(0xffffff), // more whites for visibility
        ];

        for (let i = 0; i < POINTS_COUNT; i++) {
            // Position - wider spread
            const x = (Math.random() - 0.5) * 300;
            const y = (Math.random() - 0.5) * 300;
            const z = (Math.random() - 0.5) * 400;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // Color - brighter
            const color = palette[Math.floor(Math.random() * palette.length)];
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            // Size - MUCH BIGGER
            sizes[i] = Math.random() * 8 + 3; // 3-11 instead of 1-4
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // Vertex shader
        const vertexShader = `
      uniform float uTime;
      attribute float size;
      varying vec3 vColor;
      
      void main() {
        vColor = color;
        vec3 p = position;
        
        // Infinite scroll effect - SLOWER for visibility
        p.z = -150.0 + mod(position.z + uTime * 10.0, 400.0);
        
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = size * (80.0 / -mvPosition.z); // Bigger multiplier
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

        // Fragment shader
        const fragmentShader = `
      varying vec3 vColor;
      
      void main() {
        // Create circular particles
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        
        if (dist > 0.5) discard;
        
        // Soft glow effect - BRIGHTER
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        alpha = pow(alpha, 1.5); // Less aggressive falloff
        
        // Boost brightness
        vec3 brightColor = vColor * 1.5;
        
        gl_FragColor = vec4(brightColor, alpha * 0.9);
      }
    `;

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            vertexColors: true,
        });

        const particles = new THREE.Points(geometry, material);
        particles.position.z = -150;
        scene.add(particles);
        particlesRef.current = particles;

        // Mouse move handler
        const handleMouseMove = (event: MouseEvent) => {
            mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;

            targetRotationRef.current.x = mouseRef.current.y * 0.05;
            targetRotationRef.current.y = -mouseRef.current.x * 0.05;
        };

        // Resize handler
        const handleResize = () => {
            if (!cameraRef.current || !rendererRef.current) return;

            cameraRef.current.aspect = window.innerWidth / window.innerHeight;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('resize', handleResize);

        // Animation loop
        const clock = new THREE.Clock();
        let animationFrameId: number;

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);

            const elapsedTime = clock.getElapsedTime();

            // Update shader time
            if (material.uniforms.uTime) {
                material.uniforms.uTime.value = elapsedTime;
            }

            // Smooth rotation based on mouse position
            currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * 0.02;
            currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * 0.02;

            if (particlesRef.current) {
                particlesRef.current.rotation.x = currentRotationRef.current.x;
                particlesRef.current.rotation.y = currentRotationRef.current.y;
            }

            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        };

        console.log('🚀 Starting star animation with', POINTS_COUNT, 'particles');
        animate();

        // Cleanup
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);

            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100vh',
                zIndex: 0,
                pointerEvents: 'none',
                background: '#0a0a0a', // Dark background to see stars
            }}
        />
    );
}
