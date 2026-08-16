'use client'

import { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

interface MeshFabricCanvasProps {
  className?: string
  nodeCount: number
  highlightNodeId?: string
}

interface MeshNode {
  id: string
  position: THREE.Vector3
  connections: string[]
  quality: number
  isRelay: boolean
  isHighlighted: boolean
  isSelf: boolean
}

function generateNodes(count: number, highlightId?: string): MeshNode[] {
  const nodes: MeshNode[] = []
  const radius = 12

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = radius * (0.3 + Math.random() * 0.7)

    const x = r * Math.sin(phi) * Math.cos(theta)
    const y = r * Math.sin(phi) * Math.sin(theta)
    const z = r * Math.cos(phi)

    const id = `PNT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    nodes.push({
      id,
      position: new THREE.Vector3(x, y, z),
      connections: [],
      quality: 60 + Math.random() * 40,
      isRelay: Math.random() > 0.6,
      isHighlighted: id === highlightId,
      isSelf: id === highlightId,
    })
  }

  nodes.forEach((node, i) => {
    const maxConnections = node.isSelf ? 12 : (node.isRelay ? 8 : 4)
    const distances = nodes
      .map((n, j) => ({ index: j, dist: node.position.distanceTo(n.position) }))
      .filter(d => d.index !== i)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, maxConnections)

    node.connections = distances.map(d => nodes[d.index].id)
  })

  return nodes
}

function MeshNodes({ nodes }: { nodes: MeshNode[] }) {
  const groupRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)

  useFrame((_state, delta) => {
    timeRef.current += delta
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.02
      groupRef.current.rotation.x = Math.sin(timeRef.current * 0.1) * 0.1
    }
  })

  return (
    <group ref={groupRef}>
      <ConnectionLines nodes={nodes} />
      {nodes.map(node => (
        <MeshNodeObject key={node.id} node={node} time={timeRef.current} />
      ))}
    </group>
  )
}

function ConnectionLines({ nodes }: { nodes: MeshNode[] }) {
  const lineMaterial = useMemo(() =>
    new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0.15,
      color: 0xEDB40B,
    }), [])

  const highlightMaterial = useMemo(() =>
    new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0.6,
      color: 0xEDB40B,
    }), [])

  return (
    <>
      {nodes.flatMap(node =>
        node.connections
          .filter(targetId => node.id < targetId)
          .map(targetId => {
            const target = nodes.find(n => n.id === targetId)
            if (!target) return null

            const isHighlighted = node.isSelf || target.isSelf
            const positions = new Float32Array([
              node.position.x, node.position.y, node.position.z,
              target.position.x, target.position.y, target.position.z,
            ])

            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

            return (
              <primitive
                key={`${node.id}-${targetId}`}
                object={new THREE.Line(geometry, isHighlighted ? highlightMaterial : lineMaterial)}
              />
            )
          })
      )}
    </>
  )
}

function MeshNodeObject({ node, time }: { node: MeshNode; time: number }) {
  const [hovered, setHovered] = useState(false)
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (meshRef.current) {
      if (node.isSelf) {
        const scale = 1 + Math.sin(time * 2) * 0.08
        meshRef.current.scale.setScalar(scale)
      }
      meshRef.current.position.x = node.position.x + Math.sin(time + node.id.charCodeAt(0)) * 0.02
      meshRef.current.position.y = node.position.y + Math.cos(time * 0.7 + node.id.charCodeAt(0)) * 0.02
    }
  })

  const isHighlighted = node.isSelf || node.isHighlighted
  const baseColor = node.isSelf ? 0xEDB40B : (node.isRelay ? 0x0099ff : 0x00d47e)
  const glowColor = node.isSelf ? 0xEDB40B : (node.isRelay ? 0x0099ff : 0x00d47e)

  return (
    <mesh
      ref={meshRef}
      position={node.position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[node.isSelf ? 0.22 : 0.14, 16, 16]} />
      <meshStandardMaterial
        color={baseColor}
        emissive={baseColor}
        emissiveIntensity={node.isSelf ? 0.8 : (isHighlighted ? 0.5 : 0.2)}
        roughness={0.3}
        metalness={0.7}
      />

      {node.isSelf && (
        <>
          <sphereGeometry args={[0.35, 16, 16]} />
          <meshBasicMaterial
            color={glowColor}
            transparent
            opacity={0.15 + Math.sin(time * 3) * 0.05}
            side={THREE.BackSide}
          />
          <sphereGeometry args={[0.42, 16, 16]} />
          <meshBasicMaterial
            color={glowColor}
            transparent
            opacity={0.08 + Math.sin(time * 2.5) * 0.03}
            side={THREE.BackSide}
          />
        </>
      )}

      {hovered && (
        <Html
          position={[0, node.isSelf ? 0.5 : 0.35, 0]}
          transform
          className="pointer-events-none"
        >
          <div className="px-2 py-1 bg-pantom-surface/95 backdrop-blur border border-pantom-border rounded text-[11px] font-mono text-pantom-gold whitespace-nowrap">
            {node.id} {node.isSelf && <span className="ml-1 text-pantom-green">● SELF</span>}
            <br />
            <span className="text-pantom-textMuted">Quality: {node.quality}%</span>
            {node.isRelay && <span className="ml-2 text-pantom-blue">◈ RELAY</span>}
          </div>
        </Html>
      )}
    </mesh>
  )
}

export function MeshFabricCanvas({ className, nodeCount, highlightNodeId }: MeshFabricCanvasProps) {
  const nodes = useMemo(() => generateNodes(nodeCount, highlightNodeId), [nodeCount, highlightNodeId])

  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 28], fov: 45 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 10]} intensity={0.6} color="#EDB40B" />
        <pointLight position={[-5, 5, 5]} intensity={0.4} color="#00d47e" />
        <MeshNodes nodes={nodes} />
      </Canvas>
    </div>
  )
}