import React, { useState, useEffect } from 'react';
import { Draggable, DragDropContext, Droppable } from 'react-beautiful-dnd';
import './actionItems.css'; // CSS file import
import Modal from 'react-modal'; // Import react-modal

const ActionPoints = ({ actionPoints, onReorder, onToggleComplete, onUpdateTitle, onAddActionPoint }) => {
  const [items, setItems] = useState([]);
  const [editId, setEditId] = useState(null); // For editing action points
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [selectedActionItem, setSelectedActionItem] = useState(null); // For modal details
  const [isModalOpen, setIsModalOpen] = useState(false); // Modal open state

  useEffect(() => {
    if (actionPoints && actionPoints.length > 0) {
      const sortedItems = [...actionPoints].sort((a, b) => a.sorting_id - b.sorting_id); // Sort by sorting_id
      setItems(sortedItems);
    } else {
      setItems([]);
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
    setNewTitle(title); // Prepopulate the input with the current title
  };

  const handleTitleChange = (e) => setNewTitle(e.target.value);

  const handleTitleSave = (id) => {
    if (newTitle.trim()) {
      onUpdateTitle(id, newTitle);
      setEditId(null);
    }
  };

  const handleKeyPress = (e, id) => {
    if (e.key === 'Enter') {
      handleTitleSave(id);
    }
  };

  const handleAddActionPoint = () => {
    if (addTitle.trim()) {
      onAddActionPoint(addTitle);
      setAddTitle('');
      setIsAdding(false);
    }
  };

  const handleCancelAdd = () => {
    setAddTitle('');
    setIsAdding(false);
  };

  const openModal = (item) => {
    setSelectedActionItem(item);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedActionItem(null);
  };

  const handleCheckboxClick = (event, id, completed) => {
    event.stopPropagation();
  
    const newCompletedStatus = !completed;
  
    fetch(`/api/action_item/${id}/complete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ completed: newCompletedStatus }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      if (data.status === 'success') {
        onToggleComplete(id, newCompletedStatus);  // Update the UI
      } else {
        console.error('Failed to update action item completion:', data.message);
      }
    })
    .catch(error => {
      console.error('Error:', error);
    });
  };

  return (
    <div>
      {items.length > 0 ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="actionPoints">
            {(provided, snapshot) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="task-list">
                {items.map((item, index) => (
                  <Draggable key={item.id.toString()} draggableId={item.id.toString()} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`task-item ${snapshot.isDragging ? 'dragging' : ''} ${item.completed ? 'completed' : ''}`}
                        onClick={() => openModal(item)} // Open modal on click
                      >
                        <div className="task-left">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onClick={(event) => handleCheckboxClick(event, item.id, item.completed)} // Pass the completed status
                          />
                          <div className="task-details">
                            {editId === item.id ? (
                              <input
                                type="text"
                                value={newTitle}
                                onChange={handleTitleChange}
                                onKeyPress={(e) => handleKeyPress(e, item.id)}
                                onBlur={() => handleTitleSave(item.id)}
                                className="edit-input"
                                autoFocus
                              />
                            ) : (
                              <p className="task-title">{item.title}</p>
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

      {/* Add Action Point */}
      {isAdding ? (
        <div className="add-action-point">
          <input
            type="text"
            placeholder="Enter new action point title"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddActionPoint()}
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

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeModal}
        contentLabel="Action Item Details"
        className="action-item-modal"
        overlayClassName="action-item-overlay"
      >
        {selectedActionItem && (
          <div className="modal-content">
            <h2>{selectedActionItem.title}</h2>
            <p><strong>Due Date:</strong> {selectedActionItem.due_date || 'Not set'}</p>
            <p><strong>Description:</strong> {selectedActionItem.description || 'No description'}</p>
            <button onClick={closeModal}>Close</button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ActionPoints;