#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
user_problem_statement: "Allow super admin to change level of access to users (promote/demote roles between student/admin/super_admin)."

backend:
  - task: "Super admin can change user role via PATCH /api/users/{user_id}"
    implemented: true
    working: false
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added 'role' to UserUpdateRequest. Super admin can now change role; admins still cannot. Safety guards: cannot demote the last active super_admin, cannot change own role (self-edit allowed=name/phone only). Role transition: leaving 'student' clears belt_rank; becoming 'student' assigns 'White Belt' if missing."
        - working: false
          agent: "testing"
          comment: "CRITICAL BUG FOUND: The safety check to prevent demoting the last super_admin is not working. Line 425 counts ALL super_admins including the one being demoted. When there are 2 super_admins and we try to demote one, the count is 2, so the check 'sa_count <= 1' doesn't trigger. But after demotion, only 1 super_admin would remain. FIX: Change line 425 to exclude the user being demoted: sa_count = await db.users.count_documents({'role': 'super_admin', 'active': True, 'id': {'$ne': user_id}}), and change line 426 to 'if sa_count < 1'. Test results: 9/10 scenarios passed. Scenarios 1-7, 9-10 all work correctly. Scenario 8 (cannot demote last super_admin) FAILED - demotion succeeded when it should have returned 400 error."

frontend:
  - task: "Role dropdown in EditUserModal (super admin only)"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/dashboard/AdminDashboard.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added 'Role / Access Level' dropdown in EditUserModal. Visible only when isSuper && editing user is not self. Belt-rank field now shows based on form.role (so it appears/disappears as role changes). User did not request frontend testing yet."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Super admin can change user role via PATCH /api/users/{user_id}"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "Added role-change capability for super admin. Test scenarios: (1) super_admin promotes student→admin (success, belt cleared). (2) super_admin demotes admin→student (success, belt='White Belt' if was None). (3) admin tries to change role of student (must be IGNORED — admin cannot send role; payload silently dropped, 200 OK with role unchanged). (4) super_admin tries to change own role (allowed set excludes role for self, so silently ignored — 200 OK, role unchanged). (5) super_admin tries to demote the last active super_admin → 400 'Cannot demote the last super admin'. Login as superadmin@yoshitaka.com / SuperAdmin2026!. Use Bearer token from /auth/login."
    - agent: "testing"
      message: "Completed comprehensive backend testing of role-change capability. Created backend_test.py with 10 test scenarios covering all requirements. CRITICAL BUG FOUND in scenario 8: The safety check to prevent demoting the last super_admin is not working correctly. The count at line 425 includes the user being demoted, so when there are 2 super_admins and we try to demote one (which would leave only 1), the check doesn't trigger and the demotion succeeds. This violates the requirement that there must always be at least 1 super_admin. All other scenarios (1-7, 9-10) passed successfully: login works, role promotions/demotions work with correct belt_rank transitions, admins cannot change roles (silently ignored), self-edit role changes are silently ignored, existing flows (name/belt updates, admin permissions) all work correctly, and smoke tests for /auth/me, /access-codes, /payments all pass."
