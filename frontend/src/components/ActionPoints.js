import React, { useState, useEffect } from 'react';
import { Draggable, DragDropContext, Droppable } from 'react-beautiful-dnd';
import './actionItems.css';  // Import the CSS file

const ActionPoints = ({ actionPoints, onReorder, onToggleComplete, onUpdateTitle }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);  // Add loading state
  const [editId, setEditId] = useState(null);  // Track the item being edited
  const [newTitle, setNewTitle] = useState('');  // Track the new title being edited

  // Sort by sort_id and set items
  useEffect(() => {
    if (actionPoints && actionPoints.length > 0) {
      const sortedItems = [...actionPoints].sort((a, b) => a.sorting_id - b.sorting_id);  // Sort by sorting_id
      setItems(sortedItems);
      setLoading(false);  // Stop loading when items are set
    }
  }, [actionPoints]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const reorderedItems = Array.from(items);
    const [removed] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, removed);

    setItems(reorderedItems);
    onReorder(reorderedItems);
  };

  const handleEditClick = (id, title) => {
    setEditId(id);
    setNewTitle(title);  // Prepopulate the input field with the current title
  };

  const handleTitleChange = (e) => {
    setNewTitle(e.target.value);
  };

  const handleTitleSave = (id) => {
    onUpdateTitle(id, newTitle);  // Trigger the update callback
    setEditId(null);  // Exit edit mode
  };

  const handleKeyPress = (e, id) => {
    if (e.key === 'Enter') {
      handleTitleSave(id);  // Save the title when 'Enter' is pressed
    }
  };

  // Display loading message while data is being fetched/processed
  if (loading) {
    return <div>Loading action points...</div>;
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="actionPoints">
        {(provided, snapshot) => (
          <div 
            {...provided.droppableProps} 
            ref={provided.innerRef} 
            className={`task-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
          >
            {items.map((item, index) => (
              <Draggable key={item.id.toString()} draggableId={item.id.toString()} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`task-item ${snapshot.isDragging ? 'dragging' : ''} ${item.completed ? 'completed' : ''}`}
                  >
                    <div className="task-left">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => onToggleComplete(item.id)}
                      />
                      <div className="task-details">
                        {/* Inline editing for the title */}
                        {editId === item.id ? (
                          <input
                            type="text"
                            value={newTitle}
                            onChange={handleTitleChange}
                            onKeyPress={(e) => handleKeyPress(e, item.id)}
                            onBlur={() => handleTitleSave(item.id)}  // Save on blur
                            className="edit-input"
                            autoFocus
                          />
                        ) : (
                          <p 
                            className="task-title" 
                            onClick={() => handleEditClick(item.id, item.title)}  // Enter edit mode on click
                          >
                            {item.title}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default ActionPoints;