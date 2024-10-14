import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Table, Button, Modal, Form, Spinner } from 'react-bootstrap';
import { useUser } from '../UserContext';

const UserManagementPage = () => {
  const { user } = useUser();
  const [users, setUsers] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');  // New password field
  const [newUserRole, setNewUserRole] = useState('user');      // New role field
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [error, setError] = useState('');
  
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${backendUrl}/users`);  
      if (response.status === 200) {
        setUsers(response.data.users);
      } else {
        setError('Failed to fetch users');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Error fetching users');
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserFirstName || !newUserLastName || !newUserPassword) {
      alert('Please fill in all fields.');
      return;
    }

    setIsAddingUser(true);

    try {
      const response = await axios.post(`${backendUrl}/users`, {
        email: newUserEmail,
        first_name: newUserFirstName,  // First name
        last_name: newUserLastName,    // Last name
        password: newUserPassword,     // Include password field
        role: newUserRole              // Include role field
      });
      if (response.status === 201) {
        setUsers(prevUsers => [...prevUsers, response.data.user]);
        setNewUserEmail('');
        setNewUserFirstName('');
        setNewUserLastName('');
        setNewUserPassword('');  // Clear password after submission
        setNewUserRole('user');  // Reset role to default
        setShowAddUserModal(false);
      } else {
        setError('Failed to add user');
      }
    } catch (err) {
      console.error('Error adding user:', err);
      setError('Error adding user');
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const response = await axios.delete(`${backendUrl}/users/${userId}`);
        if (response.status === 200) {
          setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
        } else {
          setError('Failed to delete user');
        }
      } catch (err) {
        console.error('Error deleting user:', err);
        setError('Error deleting user');
      }
    }
  };

  return (
    <Container>
      <h2>User Management</h2>
      <Button variant="primary" onClick={() => setShowAddUserModal(true)} className="mb-3">
        Add New User
      </Button>

      {error && <div className="error-message mb-3">{error}</div>}

      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Email</th>
            <th>First Name</th>
            <th>Last Name</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.first_name}</td> {/* Use first_name */}
              <td>{u.last_name}</td>  {/* Use last_name */}
              <td>{u.role}</td>       {/* Role */}
              <td>
                <Button variant="danger" size="sm" onClick={() => handleDeleteUser(u.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Add User Modal */}
      <Modal show={showAddUserModal} onHide={() => setShowAddUserModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add New User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group controlId="formUserEmail" className="mb-3">
              <Form.Label>Email address</Form.Label>
              <Form.Control 
                type="email" 
                placeholder="Enter email" 
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
            </Form.Group>

            <Form.Group controlId="formUserFirstName" className="mb-3">
              <Form.Label>First Name</Form.Label>
              <Form.Control 
                type="text" 
                placeholder="Enter first name" 
                value={newUserFirstName}
                onChange={(e) => setNewUserFirstName(e.target.value)}
              />
            </Form.Group>

            <Form.Group controlId="formUserLastName" className="mb-3">
              <Form.Label>Last Name</Form.Label>
              <Form.Control 
                type="text" 
                placeholder="Enter last name" 
                value={newUserLastName}
                onChange={(e) => setNewUserLastName(e.target.value)}
              />
            </Form.Group>

            <Form.Group controlId="formUserPassword" className="mb-3"> {/* New Password Field */}
              <Form.Label>Password</Form.Label>
              <Form.Control 
                type="password" 
                placeholder="Enter password" 
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
            </Form.Group>

            <Form.Group controlId="formUserRole" className="mb-3"> {/* New Role Field */}
              <Form.Label>Role</Form.Label>
              <Form.Control 
                as="select" 
                value={newUserRole} 
                onChange={(e) => setNewUserRole(e.target.value)}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </Form.Control>
            </Form.Group>
          </Form>
          {isAddingUser && <Spinner animation="border" role="status"><span className="visually-hidden">Adding...</span></Spinner>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddUserModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddUser} disabled={isAddingUser}>
            {isAddingUser ? 'Adding...' : 'Add User'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default UserManagementPage;