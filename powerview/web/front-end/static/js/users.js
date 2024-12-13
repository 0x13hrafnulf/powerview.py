document.addEventListener('DOMContentLoaded', () => {
    let identityToDelete = null;
    let rowToDelete = null;

    async function fetchAndPopulateUsers() {
        try {
            const response = await fetch('/api/get/domainuser', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    properties: ["cn", "sAMAccountname", "mail", "adminCount"]
                })
            });
            await handleHttpError(response);

            const users = await response.json();
            populateUsersTable(users);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    }

    function filterUsers() {
        const searchInput = document.getElementById('user-search').value.toLowerCase();
        const rows = document.querySelectorAll('tbody tr');

        rows.forEach(row => {
            const name = row.querySelector('td:nth-child(1)').textContent.toLowerCase();
            const email = row.querySelector('td:nth-child(2)').textContent.toLowerCase();

            if (name.includes(searchInput) || email.includes(searchInput)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    document.getElementById('user-search').addEventListener('input', filterUsers);

    function populateUsersTable(users) {
        const table = document.getElementById('users-result-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';

        if (users.length > 0) {
            // Get attribute keys from the first user to create table headers
            const attributeKeys = Object.keys(users[0].attributes);

            // Create table headers
            thead.innerHTML = ''; // Clear existing headers
            const headerRow = document.createElement('tr');
            attributeKeys.forEach(key => {
                const th = document.createElement('th');
                th.scope = 'col';
                th.className = 'p-1';
                th.textContent = key;
                headerRow.appendChild(th);
            });

            // Add an extra header for actions
            const actionTh = document.createElement('th');
            actionTh.scope = 'col';
            actionTh.className = 'p-1';
            actionTh.textContent = 'Action';
            headerRow.appendChild(actionTh);

            thead.appendChild(headerRow);

            // Populate table rows
            users.forEach(user => {
                const tr = document.createElement('tr');
                tr.classList.add('dark:hover:bg-white/5', 'dark:hover:text-white', 'cursor-pointer');
                tr.dataset.identity = user.dn;
                tr.addEventListener('click', async (event) => {
                    // Don't trigger if clicking action buttons
                    if (event.target.closest('button')) return;
                    await handleLdapLinkClick(event, user.dn);
                });

                attributeKeys.forEach(key => {
                    const td = document.createElement('td');
                    td.className = 'p-1 whitespace-nowrap';
                    const value = user.attributes[key];
                    if (key === 'adminCount') {
                        const statusSpan = document.createElement('span');
                        if (value === 1) {
                            statusSpan.className = 'px-1 inline-flex text-xs leading-4 font-semibold rounded-md bg-green-100 text-green-800';
                            statusSpan.textContent = 'True';
                        } else {
                            statusSpan.textContent = '';
                        }
                        td.appendChild(statusSpan);
                    } else {
                        if (Array.isArray(value)) {
                            td.innerHTML = value.join('<br>');
                        } else {
                            td.textContent = value;
                        }
                    }
                    tr.appendChild(td);
                });

                // Add action buttons
                const actionTd = document.createElement('td');
                actionTd.className = 'p-2 whitespace-nowrap';
                const editButton = document.createElement('button');
                editButton.className = 'px-1 py-0.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 focus:outline-none focus:shadow-outline-blue active:bg-blue-600 transition duration-150 ease-in-out';
                editButton.textContent = 'Edit';
                actionTd.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.className = 'ml-1 px-1 py-0.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-500 focus:outline-none focus:shadow-outline-red active:bg-red-600 transition duration-150 ease-in-out';
                deleteButton.textContent = 'Delete';
                deleteButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    showDeleteModal(user.attributes.cn, tr);
                });
                actionTd.appendChild(deleteButton);

                tr.appendChild(actionTd);

                tbody.appendChild(tr);
            });
        }
    }

    async function addUser(username, password) {
        try {
            const response = await fetch('/api/add/domainuser', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, userpass: password })
            });

            await handleHttpError(response);

            const result = await response.json();
            console.log('User added:', result);

            // Refresh the user list
            fetchAndPopulateUsers();
        } catch (error) {
            console.error('Error adding user:', error);
        }
    }

    function showDeleteModal(username, rowElement) {
        identityToDelete = username;
        rowToDelete = rowElement;
        const modal = document.getElementById('popup-modal');
        const overlay = document.getElementById('modal-overlay');
        document.getElementById('identity-to-delete').textContent = username;
        modal.classList.remove('hidden');
        overlay.classList.remove('hidden');
    }

    function showAddUserModal() {
        const modal = document.getElementById('add-user-modal');
        const overlay = document.getElementById('modal-overlay');
        modal.classList.remove('hidden');
        overlay.classList.remove('hidden');
    }

    document.getElementById('confirm-delete').addEventListener('click', async () => {
        if (identityToDelete && rowToDelete) {
            await deleteUser(identityToDelete, rowToDelete);
            identityToDelete = null;
            rowToDelete = null;
            document.getElementById('popup-modal').classList.add('hidden');
            document.getElementById('modal-overlay').classList.add('hidden');
        }
    });

    // Add event listener for the close button
    document.querySelectorAll('[data-modal-hide]').forEach(button => {
        button.addEventListener('click', () => {
            const modalId = button.getAttribute('data-modal-hide');
            document.getElementById(modalId).classList.add('hidden');
            document.getElementById('modal-overlay').classList.add('hidden');
        });
    });

    // Add event listener for the Add User button
    document.querySelector('[data-modal-toggle="add-user-modal"]').addEventListener('click', showAddUserModal);

    document.getElementById('add-user-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;
        addUser(username, password);
        document.getElementById('add-user-modal').classList.add('hidden');
        document.getElementById('modal-overlay').classList.add('hidden');
    });

    async function deleteUser(distinguishedName, rowElement) {
        try {
            const response = await fetch('/api/remove/domainuser', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ identity: distinguishedName })
            });

            await handleHttpError(response);

            const result = await response.json();
            console.log('User deleted:', result);

            // Remove the row from the table
            rowElement.remove();
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    }

    function collectQueryParams() {
        // Default values for all parameters
        const defaultArgs = {
            identity: document.getElementById('identity-input').value || '',
            spn: false,
            admincount: false,
            lockout: false,
            password_expired: false,
            passnotrequired: false,
            rbcd: false,
            shadowcred: false,
            preauthnotrequired: false,
            trustedtoauth: false,
            allowdelegation: false,
            disallowdelegation: false,
            unconstrained: false,
            enabled: false,
            disabled: false,
            properties: [], // Initialize as empty, will be set by collectProperties
            ldapfilter: document.getElementById('ldap-filter-input').value || '',
            searchbase: document.getElementById('searchbase-input').value || ''
        };

        // Collect current values based on data-active attribute
        const currentArgs = {
            identity: document.getElementById('identity-input').value || '',
            spn: document.getElementById('spn-toggle').getAttribute('data-active') === 'true',
            trustedtoauth: document.getElementById('trusted-to-auth-toggle').getAttribute('data-active') === 'true',
            enabled: document.getElementById('enabled-users-toggle').getAttribute('data-active') === 'true',
            preauthnotrequired: document.getElementById('preauth-not-required-toggle').getAttribute('data-active') === 'true',
            passnotrequired: document.getElementById('pass-not-required-toggle').getAttribute('data-active') === 'true',
            admincount: document.getElementById('admin-count-toggle').getAttribute('data-active') === 'true',
            lockout: document.getElementById('lockout-toggle').getAttribute('data-active') === 'true',
            rbcd: document.getElementById('rbcd-toggle').getAttribute('data-active') === 'true',
            shadowcred: document.getElementById('shadow-cred-toggle').getAttribute('data-active') === 'true',
            unconstrained: document.getElementById('unconstrained-delegation-toggle').getAttribute('data-active') === 'true',
            disabled: document.getElementById('disabled-users-toggle').getAttribute('data-active') === 'true',
            password_expired: document.getElementById('password-expired-toggle').getAttribute('data-active') === 'true',
            ldapfilter: document.getElementById('ldap-filter-input').value || '',
            searchbase: document.getElementById('searchbase-input').value || '',
            properties: collectProperties() // Use collectProperties to set the properties
        };

        // Merge defaultArgs with currentArgs
        const args = { ...defaultArgs, ...currentArgs };

        return { args };
    }

    function collectProperties() {
        const properties = [];
        const propertyButtons = document.querySelectorAll('.custom-toggle-switch[data-active="true"]');
    
        propertyButtons.forEach(button => {
            const ldapAttribute = button.getAttribute('data-ldap-attribute');
            if (ldapAttribute) {
                properties.push(ldapAttribute);
            }
        });
    
        return properties;
    }

    async function searchUsers() {
        const searchSpinner = document.getElementById('search-spinner');
        const boxOverlaySpinner = document.getElementById('box-overlay-spinner');
        searchSpinner.classList.remove('hidden'); // Show the spinner
        boxOverlaySpinner.classList.remove('hidden'); // Show the spinner

        const queryParams = collectQueryParams();
        try {
            const response = await fetch('/api/get/domainuser', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(queryParams)
            });

            await handleHttpError(response);

            const result = await response.json();
            populateUsersTable(result);
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            searchSpinner.classList.add('hidden'); // Hide the spinner
            boxOverlaySpinner.classList.add('hidden'); // Hide the spinner
        }
    }

    // Attach event listener to the search button
    document.getElementById('search-users-button').addEventListener('click', searchUsers);

    // enable if you want to fetch users on page load
    // fetchAndPopulateUsers();
});
