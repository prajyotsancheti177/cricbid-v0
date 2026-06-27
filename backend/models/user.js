const { Schema, model } = require('mongoose')
const { decrypt, encrypt } = require('../utils/encryDecry')

/**
 * User Roles:
 * - boss: Top-level admin (can create super users)
 * - super_user: Can create tournament hosts
 * - tournament_host: Can manage tournaments, teams, players
 */
const userSchema = new Schema({
    name: { type: String, require: true },
    email: { type: String, require: true, unique: true },
    password: { type: String, require: true },
    role: { 
        type: String, 
        enum: ['boss', 'super_user', 'tournament_host'],
        default: 'tournament_host',
        require: true 
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user' },
    isActive: { type: Boolean, default: true },
    logo: { type: String }, // For tournament hosts
    permissions: {
        canCreateSuperUser: { type: Boolean, default: false },
        canCreateTournamentHost: { type: Boolean, default: false },
        canManageTournaments: { type: Boolean, default: true },
        canManageTeams: { type: Boolean, default: true },
        canManagePlayers: { type: Boolean, default: true }
    }
}, { collection: "user", timestamps: true })

userSchema.pre('save', function (next) {
    let user = this;
    
    // Only encrypt password if it's new or modified
    if (user.isModified('password')) {
        user.password = encrypt(user.password);
    }
    
    // Set permissions based on role
    if (user.role === 'boss') {
        user.permissions = {
            canCreateSuperUser: true,
            canCreateTournamentHost: true,
            canManageTournaments: true,
            canManageTeams: true,
            canManagePlayers: true
        };
    } else if (user.role === 'super_user') {
        user.permissions = {
            canCreateSuperUser: false,
            canCreateTournamentHost: true,
            canManageTournaments: true,
            canManageTeams: true,
            canManagePlayers: true
        };
    } else if (user.role === 'tournament_host') {
        user.permissions = {
            canCreateSuperUser: false,
            canCreateTournamentHost: false,
            canManageTournaments: true,
            canManageTeams: true,
            canManagePlayers: true
        };
    }
    
    next()
})

module.exports = model(userSchema.options.collection, userSchema)