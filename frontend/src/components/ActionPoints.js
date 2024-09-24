import React, { useState, useEffect } from 'react';
import { Draggable, DragDropContext, Droppable } from 'react-beautiful-dnd';
import './actionItems.css';  // Import the CSS file

const ActionPoints = ({ actionPoints, onReorder, onToggleComplete, onUpdateTitle, onAddActionPoint }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);  // Add loading state
  const [editId, setEditId] = useState(null);  // Track the item being edited
  const [newTitle, setNewTitle] = useState('');  // Track the new title being edited
  const [isAdding, setIsAdding] = useState(false);  // Track whether we are adding a new action point
  const [addTitle, setAddTitle] = useState('');  // Track the new action point title

  // Sort by sort_id and set items
  useEffect(() => {
    if (actionPoints && actionPoints.length > 0) {
      const sortedItems = [...actionPoints].sort((a, b) => a.sorting_id - b.sorting_id);  // Sort by sorting_id
      setItems(sortedItems);
    } else {
      setItems([]);
    }
    setLoading(false);  // Stop loading when items are set
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
    if (newTitle.trim()) {
      onUpdateTitle(id, newTitle);  // Trigger the update callback
      setEditId(null);  // Exit edit mode
    }
  };

  const handleKeyPress = (e, id) => {
    if (e.key === 'Enter') {
      handleTitleSave(id);  // Save the title when 'Enter' is pressed
    }
  };

  const handleAddActionPoint = () => {
    // Trigger the add action point callback if the title is not empty
    if (addTitle.trim()) {
      onAddActionPoint(addTitle);  // Pass the new title to the parent component
      setAddTitle('');  // Clear the input field
      setIsAdding(false);  // Exit the add mode
    }
  };

  const handleCancelAdd = () => {
    setAddTitle('');  // Clear the input field
    setIsAdding(false);  // Cancel add mode
  };

  return (
    <div>
      {/* Display action points if available */}
      {items.length > 0 ? (
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
      ) : (
        <div className="no-action-points">
          <p>No action points available.</p>
        </div>
      )}

      {/* Add new action point */}
      {isAdding ? (
        <div className="add-action-point">
          <input
            type="text"
            placeholder="Enter new action point title"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddActionPoint()}  // Save on Enter key press
            className="add-action-input"
            autoFocus
          />
          <div className="add-action-buttons">
            <button onClick={handleAddActionPoint}>Save</button>
            <button onClick={handleCancelAdd}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="add-action-point-btn" onClick={() => setIsAdding(true)}>
          + Add Action Point
        </button>
      )}
    </div>
  );
};

export default ActionPoints;