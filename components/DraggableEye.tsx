
import React, { useState, useEffect, useRef } from 'react';

interface DraggableEyeProps {
    visible: boolean;
    onToggle: () => void;
}

export const DraggableEye: React.FC<DraggableEyeProps> = ({ visible, onToggle }) => {
    // Initial position: Right side, slightly down
    const [position, setPosition] = useState({ x: window.innerWidth - 60, y: 150 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ x: number, y: number } | null>(null);
    const startPosRef = useRef<{ x: number, y: number } | null>(null);
    const hasMoved = useRef(false);

    useEffect(() => {
        // Adjust initial position if window resizes to keep it on screen
        const handleResize = () => {
             setPosition(p => ({
                 x: Math.min(p.x, window.innerWidth - 50),
                 y: Math.min(p.y, window.innerHeight - 50)
             }));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleMove = (clientX: number, clientY: number) => {
            if (!isDragging || !dragStartRef.current || !startPosRef.current) return;
            
            const dx = clientX - dragStartRef.current.x;
            const dy = clientY - dragStartRef.current.y;
            
            // Calculate new position
            let newX = startPosRef.current.x + dx;
            let newY = startPosRef.current.y + dy;

            // Boundaries
            newX = Math.max(10, Math.min(window.innerWidth - 50, newX));
            newY = Math.max(50, Math.min(window.innerHeight - 50, newY));

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                hasMoved.current = true;
            }

            setPosition({ x: newX, y: newY });
        };

        const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
        const onTouchMove = (e: TouchEvent) => {
             e.preventDefault(); // Prevent scrolling while dragging eye
             handleMove(e.touches[0].clientX, e.touches[0].clientY);
        };

        const onEnd = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onEnd);
            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', onEnd);
        }

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onEnd);
        };
    }, [isDragging]);

    const handleStart = (clientX: number, clientY: number) => {
        setIsDragging(true);
        dragStartRef.current = { x: clientX, y: clientY };
        startPosRef.current = { ...position };
        hasMoved.current = false;
    };

    const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if (!hasMoved.current) {
            onToggle();
        }
    };

    return (
        <div
            style={{ 
                position: 'fixed', 
                left: `${position.x}px`, 
                top: `${position.y}px`,
                zIndex: 9999, // Highest z-index
                touchAction: 'none'
            }}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
            onClick={handleClick}
            className={`
                group w-10 h-10 rounded-full flex items-center justify-center 
                shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-gray-600/50
                transition-all duration-200 cursor-move select-none
                ${isDragging ? 'bg-brand-600 scale-110 opacity-100' : 'bg-dark-800/40 backdrop-blur-sm opacity-40 hover:opacity-100 hover:bg-dark-700'}
            `}
            title={visible ? "隐藏图表浮层" : "显示图表浮层"}
        >
            <i className={`fa-solid ${visible ? 'fa-eye text-brand-500' : 'fa-eye-slash text-gray-400'} text-sm transition-colors group-hover:text-white`}></i>
        </div>
    );
};
