import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Loader2, Trash2, Shield, Users, Crown } from "lucide-react";
import apiConfig from "@/config/apiConfig";

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  permissions: {
    canCreateSuperUser: boolean;
    canCreateTournamentHost: boolean;
  };
}

const UserManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "tournament_host",
    logo: "",
  });

  useEffect(() => {
    // Check if user has permission
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      navigate("/login");
      return;
    }

    const user = JSON.parse(userStr);
    setCurrentUser(user);

    if (user.role !== 'boss' && user.role !== 'super_user') {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate("/tournaments");
      return;
    }

    fetchUsers(user);
  }, []);

  const fetchUsers = async (user: User) => {
    try {
      // Use hierarchy endpoint to get all users created by this user and their descendants
      const response = await fetch(`${apiConfig.baseUrl}/api/user/hierarchy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user._id }),
      });

      const data = await response.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to fetch users",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUser.name || !newUser.email || !newUser.password) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(`${apiConfig.baseUrl}/api/user/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newUser,
          createdBy: currentUser?._id,
          userId: currentUser?._id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "User Created",
          description: `${newUser.name} has been added successfully.`,
        });

        setIsDialogOpen(false);
        setNewUser({ name: "", email: "", password: "", role: "tournament_host", logo: "" });

        if (currentUser) {
          fetchUsers(currentUser);
        }
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to create user",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to deactivate this user?")) {
      return;
    }

    try {
      const response = await fetch(`${apiConfig.baseUrl}/api/user/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId, hardDelete: false, userId: currentUser?._id }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "User Deactivated",
          description: "User has been deactivated successfully.",
        });

        if (currentUser) {
          fetchUsers(currentUser);
        }
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to deactivate user",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'boss':
        return <Badge className="bg-gradient-to-r from-purple-500 to-pink-500"><Crown className="h-3 w-3 mr-1" />Boss</Badge>;
      case 'super_user':
        return <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500"><Shield className="h-3 w-3 mr-1" />Super User</Badge>;
      case 'tournament_host':
        return <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />Tournament Host</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const canCreateRole = (role: string) => {
    if (!currentUser) return false;
    if (role === 'super_user') return currentUser.permissions?.canCreateSuperUser;
    if (role === 'tournament_host') return currentUser.permissions?.canCreateTournamentHost;
    return false;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-3xl font-bold">User Management</CardTitle>
              <CardDescription className="mt-2">
                {currentUser?.role === 'boss'
                  ? 'Manage all users in the system'
                  : 'Manage users you created and their descendants in the hierarchy'}
              </CardDescription>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleCreateUser}>
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                      Add a new user to the system. They will receive their credentials.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        placeholder="John Doe"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        placeholder="john@example.com"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        placeholder="Min. 6 characters"
                        minLength={6}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">Role *</Label>
                      <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {canCreateRole('super_user') && (
                            <SelectItem value="super_user">Super User</SelectItem>
                          )}
                          {canCreateRole('tournament_host') && (
                            <SelectItem value="tournament_host">Tournament Host</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="logo">Logo URL (Optional)</Label>
                      <Input
                        id="logo"
                        value={newUser.logo}
                        onChange={(e) => setNewUser({ ...newUser, logo: e.target.value })}
                        placeholder="https://example.com/logo.png"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create User"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No users found. Create your first user to get started.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      {user.createdBy ? (
                        <div className="text-sm">
                          <div className="font-medium">{user.createdBy.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {getRoleBadge(user.createdBy.role)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">System</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {user.role !== 'boss' && user.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user._id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
